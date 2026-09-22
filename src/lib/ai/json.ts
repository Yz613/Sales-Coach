/**
 * Parse JSON from an LLM response, repairing the mistakes models make when they
 * paste transcript quotes: missing commas, unescaped quotes, trailing commas,
 * comments, and raw newlines inside strings.
 */
export function extractJson(text: string): any {
  const trimmed = (text || "").trim();
  if (!trimmed) throw new Error("Empty model response");

  const candidates = unique([
    trimmed,
    ...fencedBlocks(trimmed),
    sliceOuterObject(trimmed),
  ]);

  let lastError: Error | undefined;
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch (err) {
      lastError = asError(err);
    }
    try {
      return JSON.parse(repairLlmJson(candidate));
    } catch (err) {
      lastError = asError(err);
    }
  }

  throw lastError || new Error("Model did not return valid JSON");
}

export function repairLlmJson(input: string): string {
  const original = (input || "").trim().replace(/^\uFEFF/, "");
  try {
    JSON.parse(original);
    return original;
  } catch {
    // Keep repairing below.
  }

  let current = stripTrailingCommas(soften(original));
  let lastPos = -1;
  let stagnant = 0;

  for (let attempt = 0; attempt < 400; attempt++) {
    try {
      JSON.parse(current);
      return current;
    } catch (err) {
      const pos = errorPosition(err);
      if (pos != null && pos === lastPos) {
        stagnant += 1;
        if (stagnant > 2) break;
      } else {
        stagnant = 0;
        lastPos = pos ?? lastPos;
      }
      const next = applyOneFix(current, err);
      if (!next || next === current) break;
      current = next;
    }
  }

  return current;
}

function asError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err));
}

function unique(items: Array<string | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (!item || seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}

function fencedBlocks(text: string): string[] {
  const blocks: string[] = [];
  const re = /```(?:json)?\s*([\s\S]*?)```/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    const body = match[1].trim();
    if (body) blocks.push(body);
  }
  return blocks;
}

function sliceOuterObject(text: string): string | undefined {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) return text.slice(start, end + 1);
  return undefined;
}

function soften(input: string): string {
  return input
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u200B\u200C\u200D\u2060]/g, "");
}

const PYTHON_LITERALS: Record<string, string> = {
  True: "true",
  False: "false",
  None: "null",
  Null: "null",
  undefined: "null",
  NaN: "null",
  Infinity: "null",
};

function applyOneFix(json: string, err: unknown): string | null {
  const message = err instanceof Error ? err.message : String(err);
  const pos = errorPosition(err);

  if (message.includes("Unexpected end of JSON") || message.includes("Unterminated string")) {
    return closeOpenStructure(json);
  }

  if (pos == null) return fixWithoutPosition(json, message);
  if (pos >= json.length) return closeOpenStructure(json);

  const ch = json[pos];

  if (message.includes("Bad control character")) {
    return json.slice(0, pos) + escapeControl(ch) + json.slice(pos + 1);
  }

  if (message.includes("Bad escaped character") && pos > 0 && json[pos - 1] === "\\") {
    return json.slice(0, pos - 1) + json.slice(pos);
  }

  if (ch === "/" && (json[pos + 1] === "/" || json[pos + 1] === "*")) {
    return stripCommentAt(json, pos);
  }
  if (ch === "#") return stripCommentAt(json, pos);

  const expectsComma = message.includes("Expected ',' or '}'") || message.includes("Expected ',' or ']'");
  const inArray = message.includes("Expected ',' or ']'");

  if (expectsComma) {
    if (ch === "/" && /[0-9]/.test(json[pos + 1] || "")) {
      let end = pos + 1;
      while (end < json.length && /[0-9.]/.test(json[end])) end++;
      return json.slice(0, pos) + json.slice(end);
    }

    const word = /^[A-Za-z_]/.test(ch) ? readIdent(json, pos) : "";
    if (word && PYTHON_LITERALS[word]) {
      return json.slice(0, pos) + PYTHON_LITERALS[word] + json.slice(pos + word.length);
    }

    if (ch === '"') {
      if (!inArray && looksLikeKey(json, pos)) return insertComma(json, pos);
      const previous = prevNonWs(json, pos);
      if (!inArray && json[previous] === '"' && previous === pos - 1) {
        return escapeQuoteAt(json, previous);
      }
      if (!inArray && json[previous] === '"') {
        const between = json.slice(previous + 1, pos);
        if (/^[\t ]*$/.test(between)) {
          const spacer = between.length > 0 ? " " : "";
          return json.slice(0, previous) + spacer + json.slice(pos + 1);
        }
      }
      return insertComma(json, pos);
    }

    if (ch === "{" || ch === "[" || ch === "-" || /[0-9]/.test(ch)) {
      return insertComma(json, pos);
    }

    // A quote closed too early and the next mark is still prose ("email" —, "pain":, 8.).
    const escaped = escapePrematureQuote(json, pos);
    if (escaped) return escaped;
    if (/[A-Za-z_]/.test(ch)) return insertComma(json, pos);
  }

  if (message.includes("Expected double-quoted property name") || message.includes("Expected property name")) {
    if (ch === "}" || ch === "]") return removeCommaBefore(json, pos);
    if (/[A-Za-z_]/.test(ch)) {
      const ident = readIdent(json, pos);
      if (PYTHON_LITERALS[ident]) {
        return json.slice(0, pos) + PYTHON_LITERALS[ident] + json.slice(pos + ident.length);
      }
      const after = skipWs(json, pos + ident.length);
      if (json[after] === ":") {
        return json.slice(0, pos) + `"${ident}"` + json.slice(pos + ident.length);
      }
      return escapePrematureQuote(json, pos);
    }
    if (ch === "'") return convertSingleQuotedString(json, pos);
  }

  if (ch === "'") return convertSingleQuotedString(json, pos);

  if (message.includes("Unexpected token") && /^[A-Za-z_]/.test(ch)) {
    const ident = readIdent(json, pos);
    if (PYTHON_LITERALS[ident]) {
      return json.slice(0, pos) + PYTHON_LITERALS[ident] + json.slice(pos + ident.length);
    }
  }

  return null;
}

function fixWithoutPosition(json: string, message: string): string | null {
  if (message.startsWith("Unexpected token ']'") || message.startsWith("Unexpected token '}'")) {
    return stripTrailingCommas(json);
  }
  if (!message.startsWith("Unexpected token '")) return null;
  const rest = message.slice("Unexpected token '".length);
  const end = rest.indexOf("',");
  if (end < 0) return null;
  const token = rest.slice(0, end);
  if (token === "'") {
    const quote = json.indexOf("'");
    return quote >= 0 ? convertSingleQuotedString(json, quote) : null;
  }
  if (/^[A-Za-z_]$/.test(token)) {
    const literal = json.match(/\b(True|False|None|Null|undefined|NaN|Infinity)\b/);
    if (literal && literal.index != null && PYTHON_LITERALS[literal[1]]) {
      return json.slice(0, literal.index) + PYTHON_LITERALS[literal[1]] + json.slice(literal.index + literal[1].length);
    }
  }
  return null;
}

function errorPosition(err: unknown): number | undefined {
  const message = err instanceof Error ? err.message : String(err);
  const match = message.match(/position (\d+)/);
  if (!match) return undefined;
  return Number(match[1]);
}

function insertComma(json: string, pos: number): string {
  return json.slice(0, pos) + "," + json.slice(pos);
}

function prevNonWs(json: string, index: number): number {
  let cursor = index - 1;
  while (cursor >= 0 && /\s/.test(json[cursor])) cursor--;
  return cursor;
}

function skipWs(json: string, index: number): number {
  let cursor = index;
  while (cursor < json.length && /\s/.test(json[cursor])) cursor++;
  return cursor;
}

function readIdent(json: string, start: number): string {
  let end = start + 1;
  while (end < json.length && /[A-Za-z0-9_]/.test(json[end])) end++;
  return json.slice(start, end);
}

function looksLikeKey(json: string, quotePos: number): boolean {
  if (json[quotePos] !== '"') return false;
  let cursor = quotePos + 1;
  const identStart = cursor;
  while (cursor < json.length && /[A-Za-z0-9_]/.test(json[cursor])) cursor++;
  if (cursor === identStart || json[cursor] !== '"') return false;
  return json[skipWs(json, cursor + 1)] === ":";
}

function escapeQuoteAt(json: string, quoteIndex: number): string | null {
  if (json[quoteIndex] !== '"') return null;
  let slashes = 0;
  for (let cursor = quoteIndex - 1; cursor >= 0 && json[cursor] === "\\"; cursor--) slashes++;
  if (slashes % 2 === 1) return null;
  return json.slice(0, quoteIndex) + '\\"' + json.slice(quoteIndex + 1);
}

/** The parser closed a string at a quote that was actually transcript punctuation. */
function escapePrematureQuote(json: string, pos: number): string | null {
  const previous = prevNonWs(json, pos);
  if (json[previous] === '"') return escapeQuoteAt(json, previous);
  if (json[previous] === ",") {
    const beforeComma = prevNonWs(json, previous);
    if (json[beforeComma] === '"') return escapeQuoteAt(json, beforeComma);
  }
  return null;
}

function removeCommaBefore(json: string, pos: number): string | null {
  const comma = prevNonWs(json, pos);
  if (json[comma] !== ",") return null;
  return json.slice(0, comma) + json.slice(comma + 1);
}

function stripCommentAt(json: string, pos: number): string {
  if (json.startsWith("//", pos) || json[pos] === "#") {
    let end = pos;
    while (end < json.length && json[end] !== "\n") end++;
    return json.slice(0, pos) + json.slice(end);
  }
  if (json.startsWith("/*", pos)) {
    const end = json.indexOf("*/", pos + 2);
    return json.slice(0, pos) + json.slice(end === -1 ? json.length : end + 2);
  }
  return json;
}

function escapeControl(ch: string): string {
  if (ch === "\n") return "\\n";
  if (ch === "\r") return "\\r";
  if (ch === "\t") return "\\t";
  return `\\u${ch.charCodeAt(0).toString(16).padStart(4, "0")}`;
}

function convertSingleQuotedString(json: string, pos: number): string | null {
  if (json[pos] !== "'") return null;
  let body = "";
  for (let cursor = pos + 1; cursor < json.length; cursor++) {
    const ch = json[cursor];
    if (ch === "\\") {
      body += ch + (json[cursor + 1] || "");
      cursor++;
      continue;
    }
    if (ch === "'") {
      const next = json[skipWs(json, cursor + 1)];
      const closes = next == null || next === "," || next === "}" || next === "]" || next === ":" || next === "'";
      if (closes) {
        return json.slice(0, pos) + `"${body.replace(/"/g, '\\"')}"` + json.slice(cursor + 1);
      }
    }
    if (ch === "\n" || ch === "\r") body += escapeControl(ch);
    else body += ch;
  }
  return json.slice(0, pos) + `"${body.replace(/"/g, '\\"')}"`;
}

function stripTrailingCommas(json: string): string {
  let out = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < json.length; i++) {
    const ch = json[i];
    if (inString) {
      out += ch;
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }
    if (ch === ",") {
      let j = i + 1;
      while (j < json.length && /\s/.test(json[j])) j++;
      if (json[j] === "}" || json[j] === "]") continue;
    }
    out += ch;
  }
  return out;
}

function closeOpenStructure(json: string): string {
  let inString = false;
  let escaped = false;
  const stack: Array<"}" | "]"> = [];
  let danglingColon = false;
  let danglingComma = false;

  for (let i = 0; i < json.length; i++) {
    const ch = json[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      danglingColon = false;
      danglingComma = false;
      continue;
    }
    if (/\s/.test(ch)) continue;
    danglingColon = false;
    danglingComma = false;
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") {
      stack.push("}");
      continue;
    }
    if (ch === "[") {
      stack.push("]");
      continue;
    }
    if (ch === "}" || ch === "]") {
      stack.pop();
      continue;
    }
    if (ch === ":") {
      danglingColon = true;
      continue;
    }
    if (ch === ",") {
      danglingComma = true;
    }
  }

  let out = json;
  if (inString) out += '"';
  if (danglingColon) out += "null";
  if (danglingComma) out = out.replace(/,\s*$/, "");
  while (stack.length) out += stack.pop();
  return out;
}
