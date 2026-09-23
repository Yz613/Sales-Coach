/**
 * Parse JSON from an LLM response. Gemini's JSON mode without a response
 * schema still emits missing commas and unescaped transcript quotes. A
 * structural guesser gets out of sync on those quotes, so the repair follows
 * JSON.parse's own error position until the text parses.
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
    for (const variant of [candidate, repairLlmJson(candidate)]) {
      try {
        return JSON.parse(variant);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }
  }

  throw lastError || new Error("Model did not return valid JSON");
}

export function repairLlmJson(input: string): string {
  const guided = repairUsingParserErrors(input);
  if (parses(guided)) return guided;
  const legacy = legacyRepair(input);
  if (parses(legacy)) return legacy;
  const guidedLegacy = repairUsingParserErrors(legacy);
  if (parses(guidedLegacy)) return guidedLegacy;
  return guided || legacy;
}

function parses(text: string): boolean {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

function legacyRepair(input: string): string {
  let s = (input || "").trim().replace(/^\uFEFF/, "");
  s = s.replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'");
  s = escapeRawControlsInStrings(s);
  s = escapeInnerQuotes(s);
  s = insertMissingCommas(s);
  s = stripTrailingCommas(s);
  return s;
}

const PARSE_POSITION = /at position (\d+)/;

function repairUsingParserErrors(input: string): string {
  let s = (input || "").trim().replace(/^\uFEFF/, "");
  const seen = new Set<string>();
  const limit = Math.max(s.length + 8000, s.length * 2);
  for (let attempt = 0; attempt < 200; attempt++) {
    try {
      JSON.parse(s);
      return s;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const next = fixParseError(s, message);
      if (!next || next === s || seen.has(next) || next.length > limit) return s;
      seen.add(next);
      s = next;
    }
  }
  return s;
}

function parsePosition(message: string): number | undefined {
  const match = message.match(PARSE_POSITION);
  if (!match) return undefined;
  const pos = Number(match[1]);
  return Number.isFinite(pos) ? pos : undefined;
}

function isJsonWhitespace(ch: string): boolean {
  return ch === " " || ch === "\n" || ch === "\r" || ch === "\t";
}

function isIllegalJsonWhitespace(ch: string): boolean {
  return Boolean(ch) && !isJsonWhitespace(ch) && /\s/u.test(ch);
}

function fixParseError(s: string, message: string): string | undefined {
  const curly = s[parsePosition(message) ?? -1];
  if (curly === "\u201C" || curly === "\u201D") {
    return s.replace(/[\u201C\u201D]/g, '"');
  }

  if (/Unexpected end of JSON input|Unterminated string/i.test(message)) {
    const closed = closeTruncated(s);
    return closed === s ? undefined : closed;
  }

  if (/Unexpected token/i.test(message) && parsePosition(message) == null) {
    return replaceNonJsonLiteral(s);
  }

  const pos = parsePosition(message);
  if (pos == null) return undefined;

  if (/Expected ',' or '}' after property value|Expected ',' or ']' after array element/i.test(message)) {
    if (pos >= s.length) {
      const closed = closeTruncated(s);
      return closed === s ? undefined : closed;
    }
    if (isIllegalJsonWhitespace(s[pos])) return s.slice(0, pos) + s.slice(pos + 1);
    if (s[pos] === "'") return replaceSingleQuotedString(s, pos);
    if (s.startsWith("//", pos) || s.startsWith("/*", pos)) return stripComment(s, pos);
    if (isJsonValueStart(s, pos)) return s.slice(0, pos) + "," + s.slice(pos);
    const quote = closingQuoteBefore(s, pos);
    if (quote >= 0) return s.slice(0, quote) + '\\"' + s.slice(quote + 1);
    return undefined;
  }

  if (/Bad control character in string literal/i.test(message) && pos < s.length) {
    const ch = s[pos];
    const repl = ch === "\n" ? "\\n" : ch === "\r" ? "\\r" : ch === "\t" ? "\\t" : "";
    if (!repl) return undefined;
    return s.slice(0, pos) + repl + s.slice(pos + 1);
  }

  if (/Bad escaped character/i.test(message) && pos > 0 && s[pos - 1] === "\\") {
    return s.slice(0, pos - 1) + s.slice(pos);
  }

  if (/Unexpected non-whitespace character after JSON/i.test(message)) {
    const cut = s.slice(0, pos).trimEnd();
    return cut === s ? undefined : cut;
  }

  if (/Expected double-quoted property name|Expected property name or '\}'|Expected property name or '\]'/i.test(message)) {
    if (s[pos] === "}" || s[pos] === "]") {
      const comma = previousNonSpace(s, pos - 1);
      if (comma >= 0 && s[comma] === ",") return s.slice(0, comma) + s.slice(comma + 1);
    }
    if (s[pos] === "'") return replaceSingleQuotedString(s, pos);
    const prose = escapeQuoteBeforeProseComma(s, pos);
    if (prose) return prose;
    if (s.startsWith("...", pos)) return s.slice(0, pos) + s.slice(pos + 3);
    if (s.startsWith("//", pos) || s.startsWith("/*", pos)) return stripComment(s, pos);
    if (isIllegalJsonWhitespace(s[pos])) return s.slice(0, pos) + s.slice(pos + 1);
    if (pos >= s.length) {
      const closed = closeTruncated(s);
      return closed === s ? undefined : closed;
    }
  }

  if (/Unexpected token/i.test(message)) {
    if (s.startsWith("undefined", pos)) return s.slice(0, pos) + "null" + s.slice(pos + "undefined".length);
    if (s.startsWith("NaN", pos)) return s.slice(0, pos) + "null" + s.slice(pos + 3);
    if (s.startsWith("Infinity", pos)) return s.slice(0, pos) + "null" + s.slice(pos + 8);
    if (s[pos] === "'") return replaceSingleQuotedString(s, pos);
    if (s.startsWith("//", pos) || s.startsWith("/*", pos)) return stripComment(s, pos);
  }

  return undefined;
}

function isJsonValueStart(s: string, i: number): boolean {
  const ch = s[i];
  if (ch === "{") return true;
  if (ch === "[") return true;
  if (ch === '"') return quoteStartsJsonToken(s, i);
  return looksLikeJsonLiteral(s, i);
}

/** A `"` begins a new key or array element, not an unescaped quote inside prose. */
function quoteStartsJsonToken(s: string, i: number): boolean {
  if (s[i] !== '"') return false;
  let j = i + 1;
  let escaped = false;
  while (j < s.length) {
    const ch = s[j];
    if (escaped) {
      escaped = false;
      j++;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      j++;
      continue;
    }
    if (ch === '"') break;
    if (ch === "\n" || ch === "\r") return false;
    j++;
  }
  if (s[j] !== '"') return false;
  let k = j + 1;
  while (k < s.length && (isJsonWhitespace(s[k]) || isIllegalJsonWhitespace(s[k]))) k++;
  const next = s[k];
  return next === ":" || next === "," || next === "]" || next === "}" || next === undefined;
}

function looksLikeJsonLiteral(s: string, i: number, depth = 0): boolean {
  if (depth > 6) return false;
  const match = s.slice(i).match(/^(?:true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/);
  if (!match) return false;
  const word = match[0];
  if ((word === "true" || word === "false" || word === "null") && /[A-Za-z0-9_]/.test(s[i + word.length] || "")) {
    return false;
  }
  let j = i + word.length;
  while (j < s.length && (isJsonWhitespace(s[j]) || isIllegalJsonWhitespace(s[j]))) j++;
  if (j >= s.length || s[j] === "}" || s[j] === "]") return true;
  if (s[j] !== ",") return false;
  let k = j + 1;
  while (k < s.length && (isJsonWhitespace(s[k]) || isIllegalJsonWhitespace(s[k]))) k++;
  if (k >= s.length) return true;
  const next = s[k];
  if (next === '"' || next === "{" || next === "[" || next === "}" || next === "]") return true;
  return looksLikeJsonLiteral(s, k, depth + 1);
}

function escapeQuoteBeforeProseComma(s: string, pos: number): string | undefined {
  if (!/[A-Za-z]/.test(s[pos] || "")) return undefined;
  let j = pos - 1;
  while (j >= 0 && (isJsonWhitespace(s[j]) || isIllegalJsonWhitespace(s[j]))) j--;
  if (s[j] !== ",") return undefined;
  const quote = closingQuoteBefore(s, j);
  if (quote < 0) return undefined;
  return s.slice(0, quote) + '\\"' + s.slice(quote + 1);
}

function closingQuoteBefore(s: string, pos: number): number {
  let j = pos - 1;
  while (j >= 0 && (isJsonWhitespace(s[j]) || isIllegalJsonWhitespace(s[j]))) j--;
  if (j < 0 || s[j] !== '"') return -1;
  let slashes = 0;
  for (let k = j - 1; k >= 0 && s[k] === "\\"; k--) slashes++;
  return slashes % 2 === 0 ? j : -1;
}

function previousNonSpace(s: string, start: number): number {
  let j = start;
  while (j >= 0 && (isJsonWhitespace(s[j]) || isIllegalJsonWhitespace(s[j]))) j--;
  return j;
}

function replaceNonJsonLiteral(s: string): string | undefined {
  for (const word of ["undefined", "NaN", "Infinity"]) {
    const at = findOutsideString(s, word);
    if (at >= 0) return s.slice(0, at) + "null" + s.slice(at + word.length);
  }
  const comment = findCommentOutsideString(s);
  if (comment >= 0) return stripComment(s, comment);
  return undefined;
}

function findOutsideString(s: string, word: string): number {
  let inString = false;
  let escaped = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (!s.startsWith(word, i)) continue;
    const before = i === 0 ? "" : s[i - 1];
    const after = s[i + word.length] || "";
    if (!/[A-Za-z0-9_]/.test(before) && !/[A-Za-z0-9_]/.test(after)) return i;
  }
  return -1;
}

function findCommentOutsideString(s: string): number {
  let inString = false;
  let escaped = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (s.startsWith("//", i) || s.startsWith("/*", i)) return i;
  }
  return -1;
}

function stripComment(s: string, i: number): string | undefined {
  if (s.startsWith("//", i)) {
    let j = i + 2;
    while (j < s.length && s[j] !== "\n") j++;
    return s.slice(0, i) + s.slice(j);
  }
  if (s.startsWith("/*", i)) {
    const end = s.indexOf("*/", i + 2);
    if (end < 0) return s.slice(0, i);
    return s.slice(0, i) + s.slice(end + 2);
  }
  return undefined;
}

function replaceSingleQuotedString(s: string, i: number): string | undefined {
  if (s[i] !== "'") return undefined;
  let body = "";
  for (let j = i + 1; j < s.length; j++) {
    if (s[j] === "\\" && j + 1 < s.length) {
      body += s[j] + s[j + 1];
      j++;
      continue;
    }
    if (s[j] === "'") {
      return s.slice(0, i) + '"' + body.replace(/"/g, '\\"') + '"' + s.slice(j + 1);
    }
    body += s[j];
  }
  return undefined;
}

function closeTruncated(s: string): string {
  let out = s.replace(/\s+$/, "");
  if (out.endsWith(",")) out = out.slice(0, -1).replace(/\s+$/, "");
  if (out.endsWith(":")) out += "null";
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  for (const ch of out) {
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") stack.push("}");
    else if (ch === "[") stack.push("]");
    else if ((ch === "}" || ch === "]") && stack.length) stack.pop();
  }
  if (inString) out += '"';
  if (out.endsWith(",")) out = out.slice(0, -1);
  if (out.endsWith(":")) out += "null";
  while (stack.length) out += stack.pop();
  return out;
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

function escapeRawControlsInStrings(json: string): string {
  let out = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < json.length; i++) {
    const ch = json[i];
    if (!inString) {
      if (ch === '"') inString = true;
      out += ch;
      continue;
    }
    if (escaped) {
      out += ch;
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      out += ch;
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = false;
      out += ch;
      continue;
    }
    if (ch === "\n") {
      out += "\\n";
      continue;
    }
    if (ch === "\r") {
      out += "\\r";
      continue;
    }
    if (ch === "\t") {
      out += "\\t";
      continue;
    }
    out += ch;
  }
  return out;
}

/** Escape " that sit inside a string value instead of ending it. */
function escapeInnerQuotes(json: string): string {
  let out = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < json.length; i++) {
    const ch = json[i];
    if (!inString) {
      if (ch === '"') inString = true;
      out += ch;
      continue;
    }
    if (escaped) {
      out += ch;
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      out += ch;
      escaped = true;
      continue;
    }
    if (ch === '"') {
      if (looksLikeStringEnd(json, i)) {
        inString = false;
        out += ch;
      } else {
        out += '\\"';
      }
      continue;
    }
    out += ch;
  }
  return out;
}

function looksLikeStringEnd(json: string, quoteIndex: number): boolean {
  let j = quoteIndex + 1;
  while (j < json.length && /\s/.test(json[j])) j++;
  if (j >= json.length) return true;
  const next = json[j];
  if (next === "," || next === "}" || next === "]" || next === ":") return true;
  // `"hello""}` — the current quote is inner; the next quote closes the string.
  if (next === '"') {
    let k = j + 1;
    while (k < json.length && /\s/.test(json[k])) k++;
    if (k >= json.length || json[k] === "," || json[k] === "}" || json[k] === "]") return false;
    return true;
  }
  if (next === "{" || next === "[") return true;
  // A bare "-" or the words true/false/null show up in transcript prose
  // ("...over." - rep folded). Only a real JSON literal ends the string.
  if ((next === "-" || /[0-9]/.test(next) || /^(?:true|false|null)(?![\w$])/.test(json.slice(j))) && looksLikeJsonLiteral(json, j)) {
    return true;
  }
  return false;
}

type Container = { type: "object" | "array"; state: "key" | "colon" | "value" | "comma" };

function insertMissingCommas(json: string): string {
  let out = "";
  let inString = false;
  let escaped = false;
  const stack: Container[] = [];

  const container = () => stack[stack.length - 1];

  const markValueFinished = () => {
    const c = container();
    if (c) c.state = "comma";
  };

  const beforeNewValue = () => {
    const c = container();
    if (c?.state === "comma") {
      out += ",";
      c.state = c.type === "object" ? "key" : "value";
    }
  };

  for (let i = 0; i < json.length; i++) {
    const ch = json[i];

    if (inString) {
      out += ch;
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
        const c = container();
        if (c?.type === "object" && c.state === "key") c.state = "colon";
        else markValueFinished();
      }
      continue;
    }

    if (/\s/.test(ch)) {
      out += ch;
      continue;
    }

    if (ch === '"') {
      beforeNewValue();
      inString = true;
      out += ch;
      continue;
    }

    if (ch === "{") {
      beforeNewValue();
      stack.push({ type: "object", state: "key" });
      out += ch;
      continue;
    }

    if (ch === "[") {
      beforeNewValue();
      stack.push({ type: "array", state: "value" });
      out += ch;
      continue;
    }

    if (ch === "}") {
      stack.pop();
      markValueFinished();
      out += ch;
      continue;
    }

    if (ch === "]") {
      stack.pop();
      markValueFinished();
      out += ch;
      continue;
    }

    if (ch === ":") {
      const c = container();
      if (c) c.state = "value";
      out += ch;
      continue;
    }

    if (ch === ",") {
      const c = container();
      if (c) c.state = c.type === "object" ? "key" : "value";
      out += ch;
      continue;
    }

    beforeNewValue();
    const literal = readLiteral(json, i);
    out += literal.text;
    i += literal.text.length - 1;
    markValueFinished();
  }

  return out;
}

function readLiteral(json: string, start: number): { text: string } {
  const rest = json.slice(start);
  const match = rest.match(/^(true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/);
  return { text: match ? match[1] : json[start] };
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
