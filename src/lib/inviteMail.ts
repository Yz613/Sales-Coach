export const DEFAULT_INVITE_FROM = "RefreshQueue <invites@refreshqueue.com>";

export type InviteEmailContent = {
  subject: string;
  text: string;
  html: string;
};

export function buildInviteEmail(input: {
  organizationName: string;
  acceptUrl: string;
  roleLabel: string;
}): InviteEmailContent {
  const org = input.organizationName.trim() || "your team";
  const role = input.roleLabel.trim() || "Member";
  const subject = `Join ${org} on RefreshQueue`;
  const text = [
    `You've been invited to join ${org} on RefreshQueue as ${role}.`,
    "",
    "Open this link to accept the invite:",
    input.acceptUrl,
    "",
    "If you weren't expecting this, you can ignore the email.",
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#070a12;color:#e2e8f0;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#070a12;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#0a0f1d;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:32px;">
            <tr>
              <td>
                <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8;">RefreshQueue</p>
                <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#f8fafc;">Join ${escapeHtml(org)}</h1>
                <p style="margin:0 0 24px;font-size:16px;line-height:1.5;color:#cbd5e1;">
                  You've been invited to join <strong style="color:#f8fafc;">${escapeHtml(org)}</strong> as
                  <strong style="color:#f8fafc;">${escapeHtml(role)}</strong>. Use the button below to accept.
                </p>
                <p style="margin:0 0 24px;">
                  <a href="${escapeHtml(input.acceptUrl)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;padding:12px 20px;border-radius:12px;">Accept invite</a>
                </p>
                <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#94a3b8;">If the button doesn't work, copy this link:</p>
                <p style="margin:0 0 24px;font-size:13px;line-height:1.5;word-break:break-all;">
                  <a href="${escapeHtml(input.acceptUrl)}" style="color:#7dd3fc;">${escapeHtml(input.acceptUrl)}</a>
                </p>
                <p style="margin:0;font-size:12px;line-height:1.5;color:#64748b;">If you weren't expecting this, you can ignore the email.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, text, html };
}

export function maskSecret(value: string): string {
  const key = value.trim();
  if (!key) return "";
  if (key.length < 12) return `${key.slice(0, 3)}••••`;
  return `${key.slice(0, 6)}••••••••${key.slice(-4)}`;
}

export type SendInviteMailInput = {
  apiKey: string;
  to: string;
  from?: string;
  replyTo?: string;
  idempotencyKey: string;
  content: InviteEmailContent;
};

export type SendInviteMailResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

/** Send a transactional invite through Resend. Returns `{ data, error }`-style outcome. */
export async function sendInviteMail(
  input: SendInviteMailInput,
  fetchImpl: typeof fetch = fetch
): Promise<SendInviteMailResult> {
  const from = (input.from || DEFAULT_INVITE_FROM).trim();
  const res = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": input.idempotencyKey.slice(0, 256),
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.content.subject,
      html: input.content.html,
      text: input.content.text,
      ...(input.replyTo ? { reply_to: [input.replyTo] } : {}),
    }),
  });

  const payload = (await res.json().catch(() => null)) as
    | { id?: string; message?: string; name?: string }
    | null;

  if (!res.ok) {
    return {
      ok: false,
      error: payload?.message || `Resend rejected the invite email (${res.status})`,
    };
  }
  if (!payload?.id) {
    return { ok: false, error: "Resend did not return an email id" };
  }
  return { ok: true, id: payload.id };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
