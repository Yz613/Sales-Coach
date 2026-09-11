/**
 * Parse JSON from an LLM response, repairing the mistakes models make when they
 * paste transcript quotes: missing commas, unescaped quotes, trailing commas,
 * and raw newlines inside strings.
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
  let s = (input || "").trim().replace(/^\uFEFF/, "");
  s = s.replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'");
  s = escapeRawControlsInStrings(s);
  s = escapeInnerQuotes(s);
  s = insertMissingCommas(s);
  s = stripTrailingCommas(s);
  return s;
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
  if (next === "-" || /[0-9]/.test(next)) return true;
  if (json.startsWith("true", j) || json.startsWith("false", j) || json.startsWith("null", j)) return true;
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
