import { createHash } from "node:crypto";
import { resolveInviteFrom, sendInviteMail, type SendInviteMailInput } from "./inviteMail";
import { INTEGRATION_REQUEST_EMAIL } from "./marketing";
import { SecurityPolicyError } from "./security-policy";
import { notifyIntegrationRequest } from "./visitorFollowUp";

export const INTEGRATION_REQUEST_TO = INTEGRATION_REQUEST_EMAIL;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HOUR_MS = 60 * 60 * 1000;

export type IntegrationRequestPayload = {
  name?: unknown;
  email?: unknown;
  integration?: unknown;
  useCase?: unknown;
  companyWebsite?: unknown;
};

export type ParsedIntegrationRequest =
  | { ok: false; error: string }
  | { ok: true; honeypot: true }
  | {
      ok: true;
      honeypot: false;
      name: string;
      email: string;
      integration: string;
      useCase: string;
    };

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function parseIntegrationRequest(body: unknown): ParsedIntegrationRequest {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Enter the integration and why you need it." };
  }
  const input = body as IntegrationRequestPayload;
  const trap = input.companyWebsite;
  if (typeof trap === "string" ? trap.trim().length > 0 : trap != null) {
    return { ok: true, honeypot: true };
  }

  const name = text(input.name);
  const email = text(input.email);
  const integration = text(input.integration).replace(/\s+/g, " ");
  const useCase = text(input.useCase);

  if (name.length > 80) return { ok: false, error: "Name is too long." };
  if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) {
    return { ok: false, error: "Enter an email so we can reply." };
  }
  if (integration.length < 2 || integration.length > 80) {
    return { ok: false, error: "Enter the integration you want." };
  }
  if (useCase.length < 10 || useCase.length > 1500) {
    return { ok: false, error: "Say briefly why you need it (at least a short sentence)." };
  }

  return { ok: true, honeypot: false, name, email, integration, useCase };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildIntegrationRequestEmail(input: {
  name: string;
  email: string;
  integration: string;
  useCase: string;
}): { subject: string; text: string; html: string } {
  const name = input.name || "(not given)";
  const subject = `Integration request: ${input.integration}`.slice(0, 120);
  const text = [
    "Integration request",
    "",
    `Name: ${name}`,
    `Email: ${input.email}`,
    `Integration: ${input.integration}`,
    "",
    "Why:",
    input.useCase,
  ].join("\n");
  const html = `<!DOCTYPE html>
<html lang="en">
  <body style="font-family:Arial,Helvetica,sans-serif;color:#1d1d1f;line-height:1.5;">
    <h1 style="font-size:18px;">Integration request</h1>
    <p><strong>Name:</strong> ${escapeHtml(name)}</p>
    <p><strong>Email:</strong> ${escapeHtml(input.email)}</p>
    <p><strong>Integration:</strong> ${escapeHtml(input.integration)}</p>
    <p><strong>Why:</strong></p>
    <p style="white-space:pre-wrap;">${escapeHtml(input.useCase)}</p>
  </body>
</html>`;
  return { subject, text, html };
}

type ConsumeLimit = (identity: string, limit: number, windowMs?: number) => Promise<void>;

export type SubmitIntegrationRequestDeps = {
  ip: string;
  env?: Record<string, string | undefined>;
  consumeLimit: ConsumeLimit;
  send?: typeof sendInviteMail;
};

export type IntegrationRequestResult = {
  status: number;
  body: { ok: true } | { error: string };
};

const DELIVERY_ERROR = `We couldn't send that request. Email ${INTEGRATION_REQUEST_TO} and we'll take it from there.`;

function clientKey(ip: string): string {
  return createHash("sha256").update(ip.trim() || "unknown").digest("hex").slice(0, 32);
}

export async function submitIntegrationRequest(
  body: unknown,
  deps: SubmitIntegrationRequestDeps
): Promise<IntegrationRequestResult> {
  const parsed = parseIntegrationRequest(body);
  if (!parsed.ok) return { status: 400, body: { error: parsed.error } };

  try {
    await deps.consumeLimit(`public:integration-request:${clientKey(deps.ip)}`, 5, HOUR_MS);
    await deps.consumeLimit("public:integration-request:global", 40, HOUR_MS);
  } catch (err) {
    if (err instanceof SecurityPolicyError && err.status === 429) {
      return { status: 429, body: { error: "Too many requests. Try again in a little while." } };
    }
    console.warn("integration request could not be rate limited");
    return { status: 422, body: { error: DELIVERY_ERROR } };
  }

  if (parsed.honeypot) return { status: 200, body: { ok: true } };

  const env = deps.env ?? process.env;
  const apiKey = env.RESEND_API_KEY?.trim() || "";
  const from = resolveInviteFrom(env.RESEND_FROM_EMAIL);
  if (!apiKey || !from) return { status: 422, body: { error: DELIVERY_ERROR } };

  const content = buildIntegrationRequestEmail(parsed);
  const send = deps.send ?? sendInviteMail;
  const mail: SendInviteMailInput = {
    apiKey,
    to: INTEGRATION_REQUEST_TO,
    from,
    replyTo: parsed.email,
    idempotencyKey: createHash("sha256")
      .update(`${parsed.email}\n${parsed.integration}\n${parsed.useCase}\n${parsed.name}`)
      .digest("hex"),
    content,
  };
  const result = await send(mail);
  if (!result.ok) return { status: 422, body: { error: DELIVERY_ERROR } };
  try {
    notifyIntegrationRequest(parsed, env);
  } catch (err) {
    console.error("visitor follow-up identify failed", err instanceof Error ? err.name : "Error");
  }
  return { status: 200, body: { ok: true } };
}

export function integrationRequestClientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    ""
  );
}
