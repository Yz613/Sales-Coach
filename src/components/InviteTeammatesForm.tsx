"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Copy, Loader2, Mail, UserPlus, X } from "lucide-react";
import { useOrganization, useUser } from "@clerk/nextjs";
import { apiPath } from "@/lib/utils";
import { useAppAuth } from "@/lib/auth-context";
import {
  inviteRoleLabel,
  parseInviteEmails,
  type InviteRole,
} from "@/lib/inviteEmails";
import type { ClerkInvitation, InviteSendResult } from "@/lib/inviteSend";
import type { TeamMember } from "@/lib/teamRoster";

type InviteListResponse = {
  invitations?: ClerkInvitation[];
  members?: TeamMember[];
  emailConfigured?: boolean;
  error?: string;
  results?: InviteSendResult[];
};

function RoleSelect({
  label,
  role,
  disabled,
  onChange,
}: {
  label: string;
  role: string;
  disabled?: boolean;
  onChange: (role: InviteRole) => void;
}) {
  const value: InviteRole = role === "org:admin" ? "org:admin" : "org:member";
  return (
    <select
      aria-label={label}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value as InviteRole)}
      className="rounded-lg border border-white/[0.08] bg-slate-950/60 px-2 py-1 text-[11px] text-white focus:border-blue-500/50 focus:outline-none disabled:opacity-50"
    >
      <option value="org:member">Member</option>
      <option value="org:admin">Admin</option>
    </select>
  );
}

function ClerkInviteTeammatesForm({
  compact = false,
  onClose,
}: {
  compact?: boolean;
  onClose?: () => void;
}) {
  const { isSignedIn, isLoaded: userLoaded, user } = useUser();
  const { isLoaded, organization, membership } = useOrganization();
  const [emailText, setEmailText] = useState("");
  const [inviteRole, setInviteRole] = useState<InviteRole>("org:member");
  const [inviting, setInviting] = useState(false);
  const [loadTimedOut, setLoadTimedOut] = useState(false);
  const [pending, setPending] = useState<ClerkInvitation[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [rosterLoaded, setRosterLoaded] = useState(false);
  const [emailConfigured, setEmailConfigured] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
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
    if (Array.isArray(data.members)) setMembers(data.members);
    if (typeof data.emailConfigured === "boolean") setEmailConfigured(data.emailConfigured);
    setRosterLoaded(true);
  };

  useEffect(() => {
    if (!organization || !canInvite) return;
    let cancelled = false;
    fetch(apiPath("/api/invites"))
      .then(async (res) => {
        const data = (await res.json()) as InviteListResponse;
        if (!cancelled && res.ok) applyList(data);
        else if (!cancelled) setRosterLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setRosterLoaded(true);
      });
    return () => {
      cancelled = true;
    };
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

  const changeRole = async (target: { userId?: string; invitationId?: string }, role: InviteRole) => {
    const key = target.userId ? `member:${target.userId}` : `invite:${target.invitationId}`;
    setBusyKey(key);
    setMessage(null);
    try {
      const res = await fetch(apiPath("/api/invites"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...target, role }),
      });
      const data = (await res.json()) as InviteListResponse;
      if (!res.ok) {
        setMessage({ tone: "err", text: data.error || "Could not change that role." });
        return;
      }
      applyList(data);
      const emailed = (data.results || []).some(
        (item) => item.ok && (item.emailDelivery === "resend" || item.emailDelivery === "clerk")
      );
      setMessage({
        tone: "ok",
        text: target.invitationId
          ? emailed
            ? `Role updated to ${inviteRoleLabel(role)}. A new invite email was sent.`
            : `Role updated to ${inviteRoleLabel(role)}. Copy the new link if the email doesn't arrive.`
          : `Role updated to ${inviteRoleLabel(role)}.`,
      });
    } catch {
      setMessage({ tone: "err", text: "Could not change that role." });
    } finally {
      setBusyKey(null);
    }
  };

  const resendInvite = async (invitation: ClerkInvitation) => {
    setBusyKey(`resend:${invitation.id}`);
    setMessage(null);
    try {
      const res = await fetch(apiPath("/api/invites/resend"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitationId: invitation.id }),
      });
      const data = (await res.json()) as InviteListResponse;
      if (!res.ok) {
        if (Array.isArray(data.invitations) || Array.isArray(data.members)) applyList(data);
        setMessage({ tone: "err", text: data.error || "Could not resend that invite." });
        return;
      }
      applyList(data);
      const sent = (data.results || []).find((item) => item.ok);
      const emailed = sent?.emailDelivery === "resend" || sent?.emailDelivery === "clerk";
      setMessage({
        tone: sent ? "ok" : "err",
        text: emailed
          ? `Invite resent to ${invitation.emailAddress}.`
          : sent
            ? `A new link is ready for ${invitation.emailAddress}. Copy it if the email doesn't arrive.`
            : data.error || "Could not resend that invite.",
      });
    } catch {
      setMessage({ tone: "err", text: "Could not resend that invite." });
    } finally {
      setBusyKey(null);
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
          ? "Invites are emailed directly via Resend. A copyable join link is also saved under Pending invites."
          : "A join link is created even if the email is slow or filtered. Copy it from Pending invites, or add a Resend API key in Admin → Settings to send emails automatically."}
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
      <div className="space-y-5 border-t border-white/[0.08] pt-4">
        <section className="space-y-2">
          <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400">On the team</div>
          {!rosterLoaded ? (
            <p className="flex items-center gap-2 text-xs text-slate-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading teammates…
            </p>
          ) : members.length === 0 ? (
            <p className="text-xs text-slate-500">No one has joined this team yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {members.map((member) => (
                <li
                  key={member.userId}
                  className="flex flex-col gap-2 rounded-xl glass-inset border border-white/[0.06] p-2.5 text-xs text-slate-300 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="truncate font-medium text-white">{member.name}</span>
                      {member.userId === user?.id && (
                        <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-slate-400">You</span>
                      )}
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-200">
                        Joined
                      </span>
                    </div>
                    {member.email && member.email !== member.name && (
                      <div className="truncate text-[11px] text-slate-400">{member.email}</div>
                    )}
                  </div>
                  <RoleSelect
                    label={`Role for ${member.name}`}
                    role={member.role}
                    disabled={busyKey === `member:${member.userId}`}
                    onChange={(role) => {
                      if (role === member.role) return;
                      void changeRole({ userId: member.userId }, role);
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-2">
          <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Pending invites</div>
          {!rosterLoaded ? null : pending.length === 0 ? (
            <p className="text-xs text-slate-500">No pending invites.</p>
          ) : (
            <ul className="space-y-1.5">
              {pending.map((invitation) => {
                const rowBusy =
                  busyKey === `invite:${invitation.id}` || busyKey === `resend:${invitation.id}`;
                return (
                  <li
                    key={invitation.id}
                    className="flex flex-col gap-2 rounded-xl glass-inset border border-white/[0.06] p-2.5 text-xs text-slate-300 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="truncate font-medium text-white">{invitation.emailAddress}</span>
                        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-200">
                          Pending
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <RoleSelect
                        label={`Role for ${invitation.emailAddress}`}
                        role={invitation.role}
                        disabled={rowBusy}
                        onChange={(role) => {
                          if (role === invitation.role) return;
                          void changeRole({ invitationId: invitation.id }, role);
                        }}
                      />
                      <button
                        type="button"
                        disabled={rowBusy}
                        onClick={() => resendInvite(invitation)}
                        className="inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-xs text-slate-300 hover:text-white disabled:opacity-50"
                      >
                        {busyKey === `resend:${invitation.id}` ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Mail className="h-3.5 w-3.5" />
                        )}
                        Resend email
                      </button>
                      <button
                        type="button"
                        onClick={() => copyLink(invitation)}
                        className="inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-xs text-slate-300 hover:text-sky-300"
                      >
                        {copiedId === invitation.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        {copiedId === invitation.id ? "Copied" : "Copy link"}
                      </button>
                      <button
                        type="button"
                        onClick={() => revokeInvite(invitation.id)}
                        className="inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-xs text-slate-400 hover:text-rose-400"
                      >
                        <X className="h-3.5 w-3.5" />
                        Revoke
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </form>
  );
}

export default function InviteTeammatesForm(props: {
  compact?: boolean;
  onClose?: () => void;
}) {
  const { isClerkConfigured } = useAppAuth();

  if (!isClerkConfigured) {
    return (
      <div className="text-center py-6 space-y-3">
        <p className="text-sm text-slate-300 font-medium">Multi-user authentication is not configured.</p>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Sales Coach is currently running in standalone mode. To create teams and invite teammates, configure Clerk in your environment variables.
        </p>
      </div>
    );
  }

  return <ClerkInviteTeammatesForm {...props} />;
}
