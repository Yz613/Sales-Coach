"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Mail, UserPlus, X } from "lucide-react";
import { useOrganization, useUser } from "@clerk/nextjs";
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
  const { isSignedIn } = useUser();
  const { isLoaded, organization, membership, invitations } = useOrganization({
    invitations: { infinite: true },
  });
  const [emailText, setEmailText] = useState("");
  const [inviteRole, setInviteRole] = useState<"org:admin" | "org:member">("org:member");
  const [inviting, setInviting] = useState(false);
  const [loadTimedOut, setLoadTimedOut] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const canInvite = membership?.role === "org:admin";

  useEffect(() => {
    if (isLoaded) {
      setLoadTimedOut(false);
      return;
    }
    const timer = window.setTimeout(() => setLoadTimedOut(true), 8000);
    return () => window.clearTimeout(timer);
  }, [isLoaded]);

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
    if (loadTimedOut) {
      return (
        <div className="space-y-2 text-sm text-slate-300">
          <p>Couldn’t load the team. Refresh, or pick a team and try again.</p>
          <Link href="/select-organization" className="inline-flex text-sky-300 hover:text-sky-200">
            Choose team
          </Link>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading team…
      </div>
    );
  }

  if (!isSignedIn) {
    return <p className="text-sm text-slate-300">Sign in first, then you can send invites.</p>;
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
          <h2 className="text-base font-semibold text-white">Invite teammates</h2>
          <p className="mt-1 text-xs text-slate-400">
            Paste one or more emails. They’ll get an email with a link to join {organization.name}.
          </p>
        </div>
      )}
      <label className="block">
        <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-slate-400">
          <Mail className="h-3.5 w-3.5" />
          Emails
        </span>
        <textarea
          value={emailText}
          onChange={(e) => setEmailText(e.target.value)}
          rows={compact ? 3 : 4}
          placeholder={"alex@company.com\nsam@company.com"}
          className="w-full rounded-xl glass-inset border border-white/[0.08] px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-blue-500/50 focus:outline-none"
        />
      </label>
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <select
          value={inviteRole}
          onChange={(e) => setInviteRole(e.target.value as "org:admin" | "org:member")}
          className="rounded-xl glass-inset border border-white/[0.08] px-3.5 py-2 text-xs text-white focus:border-blue-500/50 focus:outline-none"
        >
          <option value="org:member">Member — calls only</option>
          <option value="org:admin">Admin — full access</option>
        </select>
        <button
          type="submit"
          disabled={inviting}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-xs font-medium text-white shadow-lg shadow-blue-500/20 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 transition"
        >
          {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          Send invites
        </button>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-medium text-slate-400 hover:text-white transition px-2"
          >
            Cancel
          </button>
        )}
      </div>
      {message && (
        <p className={`text-xs ${message.tone === "ok" ? "text-emerald-400" : "text-rose-300"}`}>
          {message.text}
        </p>
      )}
      {invitations?.data && invitations.data.length > 0 && (
        <div className="space-y-2 border-t border-white/[0.08] pt-4">
          <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Pending invites</div>
          <ul className="space-y-1.5">
            {invitations.data.map((invitation) => (
              <li key={invitation.id} className="flex items-center justify-between text-xs text-slate-300 p-2.5 rounded-xl glass-inset border border-white/[0.06]">
                <span className="flex items-center gap-2">
                  <span className="font-medium text-white">{invitation.emailAddress}</span>
                  <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-slate-400 font-mono">{roleLabel(invitation.role)}</span>
                </span>
                <button
                  type="button"
                  onClick={() => revokeInvite(invitation.id)}
                  className="inline-flex items-center gap-1 text-slate-400 hover:text-rose-400 transition text-xs p-1"
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
