"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Mail, UserPlus, X } from "lucide-react";
import { useOrganization } from "@clerk/nextjs";
import { parseInviteEmails } from "@/lib/inviteEmails";

function roleLabel(role?: string | null) {
  if (role === "org:admin") return "Admin";
  if (role === "org:member") return "Member";
  return role?.replace(/^org:/, "") || role || "";
}

export default function InviteTeammatesForm({
  compact = false,
  onClose,
}: {
  compact?: boolean;
  onClose?: () => void;
}) {
  const { isLoaded, organization, membership, invitations } = useOrganization({
    invitations: { infinite: true },
  });
  const [emailText, setEmailText] = useState("");
  const [inviteRole, setInviteRole] = useState<"org:admin" | "org:member">("org:member");
  const [inviting, setInviting] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const canInvite = membership?.role === "org:admin";

  const sendInvites = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization) return;
    const emails = parseInviteEmails(emailText);
    if (emails.length === 0) {
      setMessage({ tone: "err", text: "Enter one or more email addresses." });
      return;
    }
    setInviting(true);
    setMessage(null);
    const sent: string[] = [];
    const failed: string[] = [];
    for (const email of emails) {
      try {
        await organization.inviteMember({ emailAddress: email, role: inviteRole });
        sent.push(email);
      } catch {
        failed.push(email);
      }
    }
    await invitations?.revalidate?.();
    setInviting(false);
    if (failed.length === 0) {
      setEmailText("");
      setMessage({
        tone: "ok",
        text: sent.length === 1 ? `Invite sent to ${sent[0]}` : `Invites sent to ${sent.length} people`,
      });
      return;
    }
    setMessage({
      tone: "err",
      text:
        sent.length > 0
          ? `Sent ${sent.length}. Could not invite: ${failed.join(", ")}`
          : `Could not invite: ${failed.join(", ")}`,
    });
  };

  const revokeInvite = async (invitationId: string) => {
    const invitation = invitations?.data?.find((item) => item.id === invitationId);
    if (!invitation) return;
    try {
      await invitation.revoke();
      await invitations?.revalidate?.();
    } catch (err) {
      const text = err instanceof Error ? err.message : "Could not revoke invite";
      setMessage({ tone: "err", text });
    }
  };

  if (!isLoaded) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading team…
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="space-y-2 text-sm text-slate-300">
        <p>Select a team first, then you can send invites.</p>
        <Link href="/select-organization" className="inline-flex text-sky-300 hover:text-sky-200">
          Choose team
        </Link>
      </div>
    );
  }

  if (!canInvite) {
    return <p className="text-sm text-slate-400">Only team admins can invite teammates.</p>;
  }

  return (
    <form onSubmit={sendInvites} className="space-y-4">
      {!compact && (
        <div>
          <h2 className="text-base font-bold text-white">Invite teammates</h2>
          <p className="mt-1 text-sm text-slate-400">
            Paste one or more emails. They’ll get an email with a link to join {organization.name}.
          </p>
        </div>
      )}
      <label className="block">
        <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-300">
          <Mail className="h-3.5 w-3.5" />
          Emails
        </span>
        <textarea
          value={emailText}
          onChange={(e) => setEmailText(e.target.value)}
          rows={compact ? 3 : 4}
          placeholder={"alex@company.com\nsam@company.com"}
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
        />
      </label>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <select
          value={inviteRole}
          onChange={(e) => setInviteRole(e.target.value as "org:admin" | "org:member")}
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
        >
          <option value="org:member">Member — calls only</option>
          <option value="org:admin">Admin — full access</option>
        </select>
        <button
          type="submit"
          disabled={inviting}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          Send invites
        </button>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-slate-400 hover:text-white"
          >
            Cancel
          </button>
        )}
      </div>
      {message && (
        <p className={`text-sm ${message.tone === "ok" ? "text-emerald-400" : "text-rose-300"}`}>
          {message.text}
        </p>
      )}
      {invitations?.data && invitations.data.length > 0 && (
        <div className="space-y-1.5 border-t border-slate-800 pt-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Pending invites</div>
          <ul className="space-y-1.5">
            {invitations.data.map((invitation) => (
              <li key={invitation.id} className="flex items-center justify-between text-sm text-slate-300">
                <span>
                  {invitation.emailAddress}
                  <span className="ml-2 text-slate-500">{roleLabel(invitation.role)}</span>
                </span>
                <button
                  type="button"
                  onClick={() => revokeInvite(invitation.id)}
                  className="inline-flex items-center gap-1 text-slate-500 hover:text-rose-300"
                >
                  <X className="h-3.5 w-3.5" />
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </form>
  );
}
