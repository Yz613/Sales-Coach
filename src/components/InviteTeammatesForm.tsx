"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Mail, UserPlus, X } from "lucide-react";
import { apiPath } from "@/lib/utils";
import { useAppAuth } from "@/lib/auth-context";
import type { PendingInvite, TeamInfo } from "@/lib/team-copy";

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
  const { user, isLoading: authLoading } = useAppAuth();
  const isSignedIn = Boolean(user?.id);
  const userLoaded = !authLoading;
  const [team, setTeam] = useState<TeamInfo | null>(null);
  const [invitations, setInvitations] = useState<PendingInvite[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [emailText, setEmailText] = useState("");
  const [inviteRole, setInviteRole] = useState<"org:admin" | "org:member">("org:member");
  const [inviting, setInviting] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const loadTeam = useCallback(async () => {
    if (!isSignedIn) return;
    // Pending team-selection sessions are signed out on the server.
    setLoadingTeam(true);
    try {
      const res = await fetch(apiPath("/api/team"));
      const data = await res.json();
      if (!res.ok) {
        setMessage({ tone: "err", text: data.error || "Could not load your team." });
        return;
      }
      setTeam(data.team ?? null);
      setInvitations(data.invitations ?? []);
    } catch {
      setMessage({ tone: "err", text: "Could not load your team." });
    } finally {
      setLoadingTeam(false);
    }
  }, [isSignedIn]);

  useEffect(() => {
    void loadTeam();
  }, [loadTeam]);

  const sendInvites = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSignedIn) {
      setMessage({ tone: "err", text: "Sign in first, then send invites." });
      return;
    }
    setInviting(true);
    setMessage(null);
    try {
      const res = await fetch(apiPath("/api/team/invite"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails: emailText, role: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ tone: "err", text: data.error || "Could not send invites." });
        return;
      }
      setTeam(data.team ?? team);
      setInvitations(data.invitations ?? []);
      const sent: string[] = data.sent ?? [];
      const failed: { email: string; reason?: string }[] = data.failed ?? [];
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
            ? `Sent ${sent.length}. Could not invite: ${failed.map((item) => item.email).join(", ")}`
            : `Could not invite: ${failed.map((item) => item.email).join(", ")}`,
      });
    } catch {
      setMessage({ tone: "err", text: "Could not send invites." });
    } finally {
      setInviting(false);
    }
  };

  const revokeInvite = async (invitationId: string) => {
    try {
      const res = await fetch(apiPath(`/api/team/invites/${invitationId}`), { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ tone: "err", text: data.error || "Could not revoke invite" });
        return;
      }
      setInvitations(data.invitations ?? []);
    } catch {
      setMessage({ tone: "err", text: "Could not revoke invite" });
    }
  };

  return (
    <form onSubmit={sendInvites} className="space-y-4">
      {!compact && (
        <div>
          <h2 className="text-base font-bold text-white">Invite teammates</h2>
          <p className="mt-1 text-sm text-slate-400">
            Paste emails. Each person gets a link to join
            {team?.name ? ` ${team.name}` : " your team"}.
          </p>
        </div>
      )}

      {userLoaded && isSignedIn && (
        <p className="text-xs text-slate-400">
          {loadingTeam && !team ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading team…
            </span>
          ) : team ? (
            <>
              Inviting to <span className="font-semibold text-white">{team.name}</span>
            </>
          ) : null}
        </p>
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
        {isSignedIn ? (
          <button
            type="submit"
            disabled={inviting}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Send invites
          </button>
        ) : (
          <Link
            href="/sign-in"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
          >
            Sign in to send invites
          </Link>
        )}
        {onClose && (
          <button type="button" onClick={onClose} className="text-sm text-slate-400 hover:text-white">
            Cancel
          </button>
        )}
      </div>
      {message && (
        <p className={`text-sm ${message.tone === "ok" ? "text-emerald-400" : "text-rose-300"}`}>
          {message.text}
        </p>
      )}
      {invitations.length > 0 && (
        <div className="space-y-1.5 border-t border-slate-800 pt-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Pending invites</div>
          <ul className="space-y-1.5">
            {invitations.map((invitation) => (
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
