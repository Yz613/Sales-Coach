"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Copy, Loader2, Mail, UserPlus, X } from "lucide-react";
import { useOrganization, useUser } from "@clerk/nextjs";
import { apiPath } from "@/lib/utils";
import {
  inviteRoleLabel,
  parseInviteEmails,
  type InviteRole,
} from "@/lib/inviteEmails";
import type { ClerkInvitation, InviteSendResult } from "@/lib/inviteSend";

type InviteListResponse = {
  invitations?: ClerkInvitation[];
  emailConfigured?: boolean;
  error?: string;
};

export default function InviteTeammatesForm({
  compact = false,
  onClose,
}: {
  compact?: boolean;
  onClose?: () => void;
}) {
  const { isSignedIn, isLoaded: userLoaded } = useUser();
  const { isLoaded, organization, membership } = useOrganization();
  const [emailText, setEmailText] = useState("");
  const [inviteRole, setInviteRole] = useState<InviteRole>("org:member");
  const [inviting, setInviting] = useState(false);
  const [loadTimedOut, setLoadTimedOut] = useState(false);
  const [pending, setPending] = useState<ClerkInvitation[]>([]);
  const [emailConfigured, setEmailConfigured] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
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

  const applyList = (data: InviteListResponse) => {
    if (Array.isArray(data.invitations)) setPending(data.invitations);
    if (typeof data.emailConfigured === "boolean") setEmailConfigured(data.emailConfigured);
  };

  useEffect(() => {
    if (!organization || !canInvite) return;
    fetch(apiPath("/api/invites"))
      .then(async (res) => {
        const data = (await res.json()) as InviteListResponse;
        if (res.ok) applyList(data);
      })
      .catch(() => undefined);
  }, [organization, canInvite]);

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
    try {
      const res = await fetch(apiPath("/api/invites"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails, role: inviteRole }),
      });
      const data = (await res.json()) as InviteListResponse & { results?: InviteSendResult[] };
      if (!res.ok) {
        setMessage({ tone: "err", text: data.error || "Could not send invites." });
        return;
      }
      applyList(data);
      const results = data.results || [];
      const sent = results.filter((item) => item.ok);
      const failed = results.filter((item) => !item.ok);
      const emailed = sent.filter((item) => item.emailDelivery === "resend" || item.emailDelivery === "clerk");
      if (failed.length === 0) {
        setEmailText("");
        if (emailed.length === sent.length && sent.length > 0) {
          setMessage({
            tone: "ok",
            text:
              sent.length === 1
                ? `Invite emailed to ${sent[0].email}. A copyable link is in Pending invites.`
                : `Invites emailed to ${sent.length} people. Copy a link from Pending invites if someone still doesn't see it.`,
          });
        } else {
          setMessage({
            tone: "ok",
            text: "Invite created. Email may be delayed — copy the link from Pending invites and send it directly.",
          });
        }
        return;
      }
      setMessage({
        tone: "err",
        text:
          sent.length > 0
            ? `Sent ${sent.length}. Could not invite: ${failed.map((item) => `${item.email} (${item.error})`).join("; ")}`
            : failed.map((item) => item.error || `Could not invite ${item.email}`).join("; "),
      });
    } catch {
      setMessage({ tone: "err", text: "Could not send invites. Try again." });
    } finally {
      setInviting(false);
    }
  };

  const revokeInvite = async (invitationId: string) => {
    try {
      const res = await fetch(apiPath("/api/invites"), {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitationId }),
      });
      const data = (await res.json()) as InviteListResponse;
      if (!res.ok) {
        setMessage({ tone: "err", text: data.error || "Could not revoke invite" });
        return;
      }
      applyList(data);
    } catch {
      setMessage({ tone: "err", text: "Could not revoke invite" });
    }
  };

  const copyLink = async (invitation: ClerkInvitation) => {
    if (!invitation.url) {
      setMessage({ tone: "err", text: "No accept link is available for this invite yet." });
      return;
    }
    try {
      await navigator.clipboard.writeText(invitation.url);
      setCopiedId(invitation.id);
      window.setTimeout(() => setCopiedId((current) => (current === invitation.id ? null : current)), 2000);
    } catch {
      setMessage({ tone: "err", text: invitation.url });
    }
  };

  if (userLoaded && !isSignedIn) {
    return <p className="text-sm text-slate-300">Sign in first, then you can send invites.</p>;
  }

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
      <p className="text-xs text-slate-400">
        {emailConfigured
          ? "Invites are emailed from invites@refreshqueue.com. A copyable join link is also saved under Pending invites."
          : "A join link is created even if the email is slow or filtered. Copy it from Pending invites, or add a Resend API key in Admin → Settings so invites send from invites@refreshqueue.com."}
      </p>
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
          onChange={(e) => setInviteRole(e.target.value as InviteRole)}
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
      {pending.length > 0 && (
        <div className="space-y-2 border-t border-white/[0.08] pt-4">
          <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Pending invites</div>
          <ul className="space-y-1.5">
            {pending.map((invitation) => (
              <li
                key={invitation.id}
                className="flex items-center justify-between gap-2 text-xs text-slate-300 p-2.5 rounded-xl glass-inset border border-white/[0.06]"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-medium text-white">{invitation.emailAddress}</span>
                  <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-slate-400 font-mono">
                    {inviteRoleLabel(invitation.role)}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => copyLink(invitation)}
                    className="inline-flex items-center gap-1 text-slate-400 hover:text-sky-300 transition text-xs p-1"
                  >
                    {copiedId === invitation.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedId === invitation.id ? "Copied" : "Copy link"}
                  </button>
                  <button
                    type="button"
                    onClick={() => revokeInvite(invitation.id)}
                    className="inline-flex items-center gap-1 text-slate-400 hover:text-rose-400 transition text-xs p-1"
                  >
                    <X className="h-3.5 w-3.5" />
                    Revoke
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </form>
  );
}
