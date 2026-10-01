import Link from "next/link";
import { redirect } from "next/navigation";
import { clerkClient } from "@clerk/nextjs/server";
import { getServerAuth } from "@/lib/auth";
import { billingExemptOrganization, hostedBillingRequired } from "@/lib/billingAccess";
import { loadBillingAccount } from "@/lib/billingQuota";
import { runWithTenant } from "@/lib/tenant";
import { type WorkspaceMenuItem } from "@/lib/workspaceMenu";
import WorkspaceMenu from "@/components/WorkspaceMenu";
import ClerkGate from "@/components/ClerkGate";

export const dynamic = "force-dynamic";

export default async function WorkspacesPage() {
  const auth = await getServerAuth();
  if (auth.authenticationIssue) redirect("/session-recovery");
  if (!auth.isClerkConfigured) redirect("/");
  if (!auth.userId) redirect("/sign-in");
  const client = await clerkClient();
  // Only list memberships from Clerk for the verified user, never a requested organization ID.
  const memberships = [];
  for (let offset = 0; ; offset += 100) {
    const page = await client.users.getOrganizationMembershipList({ userId: auth.userId, limit: 100, offset });
    memberships.push(...page.data);
    if (memberships.length >= page.totalCount || page.data.length === 0) break;
  }
  const teams: WorkspaceMenuItem[] = await Promise.all(memberships.map(async membership => {
    const org = membership.organization;
    let access: WorkspaceMenuItem["access"] = "unavailable";
    if (billingExemptOrganization(org.id) || !hostedBillingRequired()) {
      access = "included";
    } else {
      try {
        const account = await runWithTenant(org.id, () => loadBillingAccount({
          isClerkConfigured: true, orgId: org.id,
          clerkPlanId: org.id === auth.orgId ? auth.clerkPlanId : null,
        }));
        access = account.paid ? "paid" : "unpaid";
      } catch { console.warn("Workspace menu billing status is unavailable."); }
    }
    return { id: org.id, name: org.name, role: membership.role, current: org.id === auth.orgId, access };
  }));
  teams.sort((a, b) => Number(b.access === "included" || b.access === "paid") - Number(a.access === "included" || a.access === "paid") || a.name.localeCompare(b.name));

  return (
    <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="mb-8 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#007AFF]">Your teams</p>
        <h1 className="text-3xl font-bold text-[#1d1d1f]">Main menu</h1>
        <p className="text-sm leading-relaxed text-[#6e6e73]">Choose the team you want to open. Teams with access can be used right away.</p>
      </div>
      <ClerkGate><WorkspaceMenu teams={teams} /></ClerkGate>
      {teams.length === 0 && <p className="text-sm text-[#6e6e73]">You don’t belong to a team yet. Create a team or ask your administrator for an invitation.</p>}
      <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium text-[#0071E3]">
        <Link href="/select-organization">Choose or create a team</Link>
        <Link href="/user">Account settings</Link>
        <Link href="/marketing">Back to home</Link>
      </div>
    </main>
  );
}
