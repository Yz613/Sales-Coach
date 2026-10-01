import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { revenueRuntime, runtimeSecret } from "./runtime";

export class RevenueError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export function encryptionKey(): Buffer {
  let key = runtimeSecret("INTEGRATION_ENCRYPTION_KEY");
  if (!key) {
    if (process.env.NODE_ENV === "production" || revenueRuntime().cloudflare || process.env.CLERK_SECRET_KEY) {
      throw new RevenueError("Set INTEGRATION_ENCRYPTION_KEY before connecting integrations.", 503);
    }
    const file = path.resolve(process.env.INTEGRATION_KEY_FILE || "data/integration.key");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    try { fs.writeFileSync(file, randomBytes(32).toString("base64"), { mode: 0o600, flag: "wx" }); }
    catch (err: any) { if (err?.code !== "EEXIST") throw err; }
    key = fs.readFileSync(file, "utf8").trim();
  }
  const bytes = Buffer.from(key, "base64");
  if (bytes.length !== 32) throw new RevenueError("INTEGRATION_ENCRYPTION_KEY must be 32 random bytes encoded as base64.", 503);
  return bytes;
}

/** Workspace and connection IDs are authenticated with the ciphertext to prevent token swapping. */
export function encryptCredentials(value: Record<string, string>, context: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(Buffer.from(context));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), encrypted.toString("base64")].join(".");
}

export function decryptCredentials(value: string, context: string): Record<string, string> {
  const [version, iv, tag, content] = value.split(".");
  if (version !== "v1" || !iv || !tag || !content) throw new RevenueError("Integration credentials need to be reconnected.", 503);
  try {
    const cipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64"));
    cipher.setAAD(Buffer.from(context));
    cipher.setAuthTag(Buffer.from(tag, "base64"));
    return JSON.parse(Buffer.concat([cipher.update(Buffer.from(content, "base64")), cipher.final()]).toString("utf8"));
  } catch (err) {
    if (err instanceof RevenueError) throw err;
    throw new RevenueError("Unable to decrypt integration credentials. Restore the original encryption key or reconnect.", 503);
  }
}

const RECORDING_MAGIC = Buffer.from("SCREC1");
export function encryptRecording(bytes: Uint8Array, context: string): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(Buffer.from(`recording:${context}`));
  const encrypted = Buffer.concat([cipher.update(bytes), cipher.final()]);
  return Buffer.concat([RECORDING_MAGIC, iv, cipher.getAuthTag(), encrypted]);
}
export function decryptRecording(bytes: Uint8Array, context: string): Buffer {
  const data = Buffer.from(bytes);
  if (!data.subarray(0, RECORDING_MAGIC.length).equals(RECORDING_MAGIC)) return data;
  try {
    const cipher = createDecipheriv("aes-256-gcm", encryptionKey(), data.subarray(6, 18));
    cipher.setAAD(Buffer.from(`recording:${context}`));
    cipher.setAuthTag(data.subarray(18, 34));
    return Buffer.concat([cipher.update(data.subarray(34)), cipher.final()]);
  } catch { throw new RevenueError("Unable to read the recording. Contact your administrator.", 503); }
}

export function stableId(...parts: string[]): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

export function secureEqual(left: string, right: string): boolean {
  const a = Buffer.from(left); const b = Buffer.from(right);
  return a.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

export function safeExternalUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url.toString();
  } catch { return null; }
}

export function textInput(value: unknown, label: string, max = 200, required = true): string {
  if (typeof value !== "string") throw new RevenueError(`${label} must be text.`);
  const text = value.trim();
  if ((required && !text) || text.length > max) throw new RevenueError(`${label} must be ${required ? "1" : "0"}–${max} characters.`);
  return text;
}
