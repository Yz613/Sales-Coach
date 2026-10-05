#!/usr/bin/env node
/**
 * GitHub Actions deploy injects the hosted VISITOR_COMPANY_KV binding.
 * The committed wrangler.jsonc stays unbound so self-hosters are not pointed
 * at the production namespace. An empty VISITOR_COMPANY_KV_ID uses the hosted
 * namespace. That id is a repository variable, not a secret.
 */
const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_ID = "05bb9e51843e4b26a424ed09dad780f6";
const ID_RE = /^[0-9a-f]{32}$/;
const BINDING = "VISITOR_COMPANY_KV";

function namespaceId(env = process.env) {
  const fromEnv = String(env.VISITOR_COMPANY_KV_ID || "").trim();
  return fromEnv || DEFAULT_ID;
}

function tokenize(source) {
  const tokens = [];
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];
    if (ch === "/" && next === "/") {
      const start = i;
      while (i < source.length && source[i] !== "\n") i += 1;
      tokens.push({ type: "comment", start, end: i });
      continue;
    }
    if (ch === "/" && next === "*") {
      const start = i;
      i += 2;
      while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) i += 1;
      i = Math.min(source.length, i + 2);
      tokens.push({ type: "comment", start, end: i });
      continue;
    }
    if (ch === '"') {
      const start = i;
      i += 1;
      let value = "";
      while (i < source.length) {
        if (source[i] === "\\") {
          value += source[i + 1] || "";
          i += 2;
          continue;
        }
        if (source[i] === '"') {
          i += 1;
          break;
        }
        value += source[i];
        i += 1;
      }
      tokens.push({ type: "string", start, end: i, value });
      continue;
    }
    if ("{}[],:".includes(ch)) {
      tokens.push({ type: ch, start: i, end: i + 1 });
      i += 1;
      continue;
    }
    i += 1;
  }
  return tokens;
}

function significant(tokens) {
  return tokens.filter((token) => token.type !== "comment");
}

function bindingObjects(sig) {
  const objects = [];
  for (let i = 0; i < sig.length; i += 1) {
    const token = sig[i];
    if (token.type !== "string" || token.value !== BINDING) continue;
    if (sig[i - 1]?.type !== ":" || sig[i - 2]?.type !== "string" || sig[i - 2].value !== "binding") continue;
    let depth = 0;
    let open = -1;
    for (let j = i; j >= 0; j -= 1) {
      if (sig[j].type === "}") depth += 1;
      else if (sig[j].type === "{") {
        if (depth === 0) {
          open = j;
          break;
        }
        depth -= 1;
      }
    }
    if (open < 0) continue;
    depth = 0;
    let close = -1;
    for (let j = open; j < sig.length; j += 1) {
      if (sig[j].type === "{") depth += 1;
      else if (sig[j].type === "}") {
        depth -= 1;
        if (depth === 0) {
          close = j;
          break;
        }
      }
    }
    if (close >= 0) objects.push({ open, close });
  }
  return objects;
}

function idEdits(sig, objects, id) {
  const edits = [];
  for (const obj of objects) {
    let depth = 0;
    let found = false;
    for (let j = obj.open; j <= obj.close; j += 1) {
      if (sig[j].type === "{") depth += 1;
      else if (sig[j].type === "}") depth -= 1;
      else if (
        depth === 1 &&
        sig[j].type === "string" &&
        sig[j].value === "id" &&
        sig[j + 1]?.type === ":" &&
        sig[j + 2]?.type === "string"
      ) {
        found = true;
        const value = sig[j + 2];
        if (value.value !== id) edits.push({ start: value.start, end: value.end, text: JSON.stringify(id) });
        break;
      }
    }
    if (!found) {
      const brace = sig[obj.close];
      edits.push({ start: brace.start, end: brace.start, text: `, "id": ${JSON.stringify(id)} ` });
    }
  }
  return edits;
}

function applyEdits(source, edits) {
  const ordered = [...edits].sort((a, b) => b.start - a.start);
  let next = source;
  for (const edit of ordered) next = next.slice(0, edit.start) + edit.text + next.slice(edit.end);
  return next;
}

function topLevelKey(sig, name) {
  let depth = 0;
  for (let i = 0; i < sig.length; i += 1) {
    if (sig[i].type === "{") depth += 1;
    else if (sig[i].type === "}") depth -= 1;
    else if (sig[i].type === "string" && sig[i].value === name && depth === 1 && sig[i + 1]?.type === ":") return sig[i];
  }
  return null;
}

function kvNamespacesArray(sig) {
  let depth = 0;
  for (let i = 0; i < sig.length; i += 1) {
    if (sig[i].type === "{") depth += 1;
    else if (sig[i].type === "}") depth -= 1;
    else if (sig[i].type === "string" && sig[i].value === "kv_namespaces" && depth === 1 && sig[i + 1]?.type === ":" && sig[i + 2]?.type === "[") {
      let arrayDepth = 0;
      for (let j = i + 2; j < sig.length; j += 1) {
        if (sig[j].type === "[") arrayDepth += 1;
        else if (sig[j].type === "]") {
          arrayDepth -= 1;
          if (arrayDepth === 0) return sig[j];
        }
      }
    }
  }
  return null;
}

function lineStart(source, index) {
  const newline = source.lastIndexOf("\n", index - 1);
  return newline < 0 ? 0 : newline + 1;
}

function bindingEntry(id) {
  return `{ "binding": ${JSON.stringify(BINDING)}, "id": ${JSON.stringify(id)} }`;
}

function insertBinding(source, sig, id) {
  const entry = bindingEntry(id);
  const arrayClose = kvNamespacesArray(sig);
  if (arrayClose) {
    const before = source.slice(0, arrayClose.start).replace(/\s*$/, "");
    const separator = /\[\s*$/.test(before) ? "\n\t\t" : ",\n\t\t";
    return `${before}${separator}${entry}\n\t${source.slice(arrayClose.start)}`;
  }
  const line = `\t"kv_namespaces": [${entry}],\n`;
  const anchor = topLevelKey(sig, "d1_databases");
  if (anchor) return source.slice(0, lineStart(source, anchor.start)) + line + source.slice(lineStart(source, anchor.start));
  let depth = 0;
  let rootClose = null;
  for (const token of sig) {
    if (token.type === "{") depth += 1;
    else if (token.type === "}") {
      depth -= 1;
      if (depth === 0) {
        rootClose = token;
        break;
      }
    }
  }
  if (!rootClose) throw new Error("wrangler.jsonc has no root object to update.");
  const at = lineStart(source, rootClose.start);
  const trimmed = source.slice(0, at).replace(/\s*$/, "");
  const comma = /[,{]\s*$/.test(trimmed) ? "" : ",";
  return `${trimmed}${comma}\n\t"kv_namespaces": [${entry}]\n${source.slice(at)}`;
}

function injectVisitorCompanyKv(source, id) {
  if (!ID_RE.test(id)) throw new Error("VISITOR_COMPANY_KV_ID must be a 32-character lowercase hex namespace id.");
  const sig = significant(tokenize(source));
  const objects = bindingObjects(sig);
  if (objects.length > 0) return applyEdits(source, idEdits(sig, objects, id));
  return insertBinding(source, sig, id);
}

function main() {
  try {
    const file = path.resolve(__dirname, "..", "wrangler.jsonc");
    const fromEnv = String(process.env.VISITOR_COMPANY_KV_ID || "").trim();
    const id = namespaceId();
    const original = fs.readFileSync(file, "utf8");
    const next = injectVisitorCompanyKv(original, id);
    if (next !== original) fs.writeFileSync(file, next);
    console.log(
      fromEnv
        ? `Injected VISITOR_COMPANY_KV id ${id} from VISITOR_COMPANY_KV_ID`
        : `Injected VISITOR_COMPANY_KV id ${id} (hosted default)`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Could not inject VISITOR_COMPANY_KV.");
    process.exit(1);
  }
}

module.exports = { DEFAULT_ID, injectVisitorCompanyKv, namespaceId };

if (require.main === module) main();
