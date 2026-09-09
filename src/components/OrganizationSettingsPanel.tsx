"use client";

import { useState } from "react";
import { Building2, Loader2, Mail, UserPlus, X } from "lucide-react";
import { OrganizationProfile, Show, useOrganization } from "@clerk/nextjs";
import { clerkAppearance } from "@/lib/clerk-ui";

function orgRoleLabel(role?: string | null) {
  if (role === "org:admin") return "Admin";
  if (role === "org:member") return "Member";
  return role?.replace(/^org:/, "") || role || "";
}

export default function OrganizationSettingsPanel() {
  const { isLoaded, organization, membership, invitations } = useOrganization({
    invitations: { infinite: true },
  });
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"org:admin" | "org:member">("org:member");
  const [inviting, setInviting] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const canManage = membership?.role === "org:admin";

  const sendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization || !email.trim()) return;
    setInviting(true);
    setMessage(null);
    try {
      await organization.inviteMember({
        emailAddress: email.trim(),
        role: inviteRole,
      });
      setEmail("");
      setMessage({ tone: "ok", text: `Invite sent to ${email.trim()}` });
      await invitations?.revalidate?.();
    } catch (err) {
      const text = err instanceof Error ? err.message : "Failed to send invite";
      setMessage({ tone: "err", text });
    } finally {
      setInviting(false);
    }
  };

  const revokeInvite = async (invitationId: string) => {
    const invitation = invitations?.data?.find((item) => item.id === invitationId);
    if (!invitation) return;
    try {
      await invitation.revoke();
      await invitations?.revalidate?.();
    } catch (err) {
      const text = err instanceof Error ? err.message : "Failed to revoke invite";
      setMessage({ tone: "err", text });
    }
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-6 space-y-5">
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <Building2 className="h-5 w-5 text-indigo-400" />
        <div>
          <h2 className="text-base font-bold text-white">Team workspace</h2>
          <p className="text-xs text-slate-400">
            See the active organization, invite teammates, and manage members. Organization admins get Admin access in this app.
          </p>
        </div>
      </div>

      <Show
        when="signed-in"
        fallback={<p className="text-sm text-slate-400">Sign in to manage your organization.</p>}
      >
        <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 p-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Active team</div>
            <div className="text-sm font-semibold text-white">
              {!isLoaded ? "Loading…" : organization?.name || "None selected — use Set team in the header"}
            </div>
          </div>
          {membership?.role && (
            <span className="rounded border border-indigo-500/20 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold text-indigo-300">
              {orgRoleLabel(membership.role)}
            </span>
          )}
        </div>

        {organization && canManage && (
          <form onSubmit={sendInvite} className="space-y-3 rounded-lg border border-slate-800 bg-slate-950 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <UserPlus className="h-4 w-4 text-sky-400" />
              Invite teammates
            </div>
            <p className="text-xs text-slate-400">
              They receive an email from Clerk. Org admins get full Sales Coach access; members can only upload and review calls.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="teammate@company.com"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 py-2 pl-9 pr-3 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as "org:admin" | "org:member")}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
              >
                <option value="org:member">Member</option>
                <option value="org:admin">Admin</option>
              </select>
              <button
                type="submit"
                disabled={inviting}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {inviting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
                Send invite
              </button>
            </div>
            {message && (
              <p className={`text-xs ${message.tone === "ok" ? "text-emerald-400" : "text-rose-300"}`}>
                {message.text}
              </p>
            )}
            {invitations?.data && invitations.data.length > 0 && (
              <ul className="space-y-1.5 border-t border-slate-800 pt-3">
                {invitations.data.map((invitation) => (
                  <li key={invitation.id} className="flex items-center justify-between text-xs text-slate-300">
                    <span>
                      {invitation.emailAddress}
                      <span className="ml-2 text-slate-500">{orgRoleLabel(invitation.role)}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => revokeInvite(invitation.id)}
                      className="inline-flex items-center gap-1 text-slate-500 hover:text-rose-300"
                    >
                      <X className="h-3 w-3" />
                      Revoke
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </form>
        )}

        {organization && !canManage && (
          <p className="text-xs text-slate-400">Only organization admins can invite teammates.</p>
        )}

        {organization && (
          <div className="overflow-hidden rounded-lg border border-slate-800">
            <OrganizationProfile routing="hash" appearance={clerkAppearance} />
          </div>
        )}
      </Show>
    </div>
  );
}
