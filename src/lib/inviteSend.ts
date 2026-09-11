import { inviteRoleLabel, type InviteRole } from "./inviteEmails";
import { buildInviteEmail, sendInviteMail, type SendInviteMailResult } from "./inviteMail";

export type ClerkInvitation = {
  id: string;
  emailAddress: string;
  role: string;
  url: string | null;
  createdAt: number;
};

export type ClerkInviteApi = {
  listPending(organizationId: string): Promise<ClerkInvitation[]>;
  create(params: {
    organizationId: string;
    inviterUserId: string;
    emailAddress: string;
    role: InviteRole;
    redirectUrl: string;
    notify: boolean;
  }): Promise<ClerkInvitation>;
  revoke(params: {
    organizationId: string;
    invitationId: string;
    requestingUserId: string;
  }): Promise<void>;
};

export type InviteEmailDelivery = "resend" | "clerk" | "link_only";

export type InviteSendResult = {
  email: string;
  ok: boolean;
  invitationId?: string;
  url?: string | null;
  emailDelivery: InviteEmailDelivery;
  error?: string;
};

export function clerkErrorMessage(err: unknown, fallback = "Could not send invite"): string {
  if (err && typeof err === "object") {
    const record = err as {
      errors?: { longMessage?: string; message?: string; code?: string }[];
      message?: string;
    };
    const first = record.errors?.[0];
    if (first?.longMessage) return first.longMessage;
    if (first?.message) return first.message;
    if (typeof record.message === "string" && record.message.trim()) return record.message;
  }
  if (err instanceof Error && err.message.trim()) return err.message;
  return fallback;
}

export function isDuplicateInviteError(err: unknown): boolean {
  const record = err as { errors?: { code?: string }[] } | undefined;
  const code = record?.errors?.[0]?.code || "";
  if (code === "duplicate_record" || code === "form_identifier_exists") return true;
  const msg = clerkErrorMessage(err, "").toLowerCase();
  return msg.includes("already") && (msg.includes("invit") || msg.includes("pending"));
}

export async function sendOrganizationInvites(input: {
  organizationId: string;
  organizationName: string;
  inviterUserId: string;
  inviterEmail?: string;
  emails: string[];
  role: InviteRole;
  redirectUrl: string;
  clerk: ClerkInviteApi;
  resendApiKey?: string | null;
  fromEmail?: string;
}): Promise<InviteSendResult[]> {
  const pending = await input.clerk.listPending(input.organizationId);
  const byEmail = new Map(pending.map((item) => [item.emailAddress.toLowerCase(), item]));
  const useResend = Boolean(input.resendApiKey?.trim());
  const results: InviteSendResult[] = [];

  for (const email of input.emails) {
    results.push(await sendOneInvite({ ...input, email, existing: byEmail.get(email.toLowerCase()), useResend }));
  }
  return results;
}

async function sendOneInvite(input: {
  organizationId: string;
  organizationName: string;
  inviterUserId: string;
  inviterEmail?: string;
  email: string;
  role: InviteRole;
  redirectUrl: string;
  clerk: ClerkInviteApi;
  resendApiKey?: string | null;
  fromEmail?: string;
  existing?: ClerkInvitation;
  useResend: boolean;
}): Promise<InviteSendResult> {
  try {
    if (input.existing) {
      await input.clerk.revoke({
        organizationId: input.organizationId,
        invitationId: input.existing.id,
        requestingUserId: input.inviterUserId,
      });
    }

    let invitation: ClerkInvitation;
    try {
      invitation = await input.clerk.create({
        organizationId: input.organizationId,
        inviterUserId: input.inviterUserId,
        emailAddress: input.email,
        role: input.role,
        redirectUrl: input.redirectUrl,
        notify: !input.useResend,
      });
    } catch (err) {
      if (input.existing && isDuplicateInviteError(err)) {
        invitation = input.existing;
      } else {
        throw err;
      }
    }

    if (input.useResend && invitation.url) {
      const mailed = await deliverResend(input, invitation);
      if (!mailed.ok) {
        return {
          email: input.email,
          ok: true,
          invitationId: invitation.id,
          url: invitation.url,
          emailDelivery: "link_only",
          error: mailed.error,
        };
      }
      return {
        email: input.email,
        ok: true,
        invitationId: invitation.id,
        url: invitation.url,
        emailDelivery: "resend",
      };
    }

    return {
      email: input.email,
      ok: true,
      invitationId: invitation.id,
      url: invitation.url,
      emailDelivery: invitation.url ? (input.useResend ? "link_only" : "clerk") : "link_only",
      error: invitation.url ? undefined : "Clerk created the invite but did not return an accept link.",
    };
  } catch (err) {
    return {
      email: input.email,
      ok: false,
      emailDelivery: input.useResend ? "link_only" : "clerk",
      error: clerkErrorMessage(err),
    };
  }
}

async function deliverResend(
  input: {
    organizationName: string;
    email: string;
    role: InviteRole;
    resendApiKey?: string | null;
    fromEmail?: string;
    inviterEmail?: string;
  },
  invitation: ClerkInvitation
): Promise<SendInviteMailResult> {
  const content = buildInviteEmail({
    organizationName: input.organizationName,
    acceptUrl: invitation.url as string,
    roleLabel: inviteRoleLabel(input.role),
  });
  return sendInviteMail({
    apiKey: input.resendApiKey as string,
    to: input.email,
    from: input.fromEmail,
    replyTo: input.inviterEmail,
    idempotencyKey: `org-invite/${invitation.id}`,
    content,
  });
}
