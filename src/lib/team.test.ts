import assert from "node:assert/strict";
import { parseInviteRole, publicTeamError } from "./team-copy";

assert.equal(parseInviteRole("org:admin"), "org:admin");
assert.equal(parseInviteRole("org:member"), "org:member");
assert.equal(parseInviteRole("admin"), "org:member");
assert.equal(parseInviteRole(undefined), "org:member");

assert.equal(
  publicTeamError(new Error("Clerk Organizations are not enabled")),
  "Teams are not enabled"
);
assert.equal(publicTeamError(new Error("Something else")), "Something else");

console.log("team helper checks passed");

async function membershipChecks(): Promise<void> {
  const { ensureActiveTeam } = await import("./team");
  let created = 0;
  const pages: number[] = [];
  const client = {
    users: {
      getOrganizationMembershipList: async ({ offset }: { offset: number }) => {
        pages.push(offset);
        return { data: offset === 0 ? Array.from({ length: 100 }, (_, i) => ({
          role: "org:member", organization: { id: `org_${i}`, name: `Team ${i}` },
        })) : [{ role: "org:member", organization: { id: "org_selected", name: "Selected" } }] };
      },
      getUser: async () => ({ firstName: "Alex" }),
    },
    organizations: {
      createOrganization: async () => { created++; return { id: "org_new", name: "New team" }; },
    },
  } as unknown as NonNullable<Parameters<typeof ensureActiveTeam>[2]>;
  assert.deepEqual(await ensureActiveTeam("user_test", "org_selected", client), {
    id: "org_selected", name: "Selected", role: "org:member",
  });
  assert.deepEqual(pages, [0, 100]);
  await assert.rejects(ensureActiveTeam("user_test", "org_foreign", client), /not a member/);
  assert.equal(created, 0, "selected teams must not create or restore admin membership");
  client.users.getOrganizationMembershipList = async () => ({ data: [], totalCount: 0 });
  assert.equal((await ensureActiveTeam("user_test", undefined, client)).id, "org_new");
  assert.equal(created, 1);
}
membershipChecks().catch(error => { console.error(error); process.exitCode = 1; });
