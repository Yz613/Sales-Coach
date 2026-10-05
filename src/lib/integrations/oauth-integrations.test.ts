import assert from "node:assert/strict";
import { after, test } from "node:test";
import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { OAUTH_APPS, type OAuthProvider } from "./oauth-config";
import { INTEGRATION_TOOLS } from "./catalog";
import { taskDestinations } from "./tasks";
import { createCrmNote } from "./outbound";
import { crmProviderPage } from "./crm-providers";

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "sales-oauth-integrations-"));
process.env.SALES_COACH_DB_PATH = path.join(directory, "test.db");
process.env.INTEGRATION_ENCRYPTION_KEY = randomBytes(32).toString("base64");
process.env.PUBLIC_APP_URL = "https://coach.example.com";
for (const app of Object.values(OAUTH_APPS)) {
  process.env[`${app.prefix}_CLIENT_ID`] = "app-id";
  process.env[`${app.prefix}_CLIENT_SECRET`] = "app-secret";
}
after(() => fs.rmSync(directory, { recursive: true, force: true }));
const jwt = () => `header.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.signature`;
const hooks = { slack: "https://hooks.slack.com/services/T1/B1/secret", discord: "https://discord.com/api/webhooks/123/secret" };

// These fixtures exercise the differing vendor contracts, including tokens that do not expire.
const permanent = new Set(["clickup", "attio", "github"]);
const jsonProviders = new Set(["clickup", "notion", "monday"]);
const basicProviders = new Set(["calendly", "pipedrive", "notion", "airtable", "slack", "discord", "zoom"]);
test("all 21 account sign-ins exchange codes using each provider's contract and reject replay", async () => {
  const { startOAuth, finishOAuth, oauthAvailability, authorizedSecrets } = await import("./oauth");
  const { runWithTenant } = await import("../tenant");
  assert.equal(Object.keys(OAUTH_APPS).length, 21);
  assert.equal(INTEGRATION_TOOLS.filter(tool => tool.oauth).length, 21);
  for (const ready of Object.values(oauthAvailability())) assert.equal(ready, true);
  await runWithTenant("org-sign-in", async () => {
    for (const [provider, app] of Object.entries(OAUTH_APPS) as [OAuthProvider, typeof OAUTH_APPS[OAuthProvider]][]) {
      const started = await startOAuth(provider, "admin", { name: "My tool", autoSync: false }, "https://coach.example.com");
      const authorize = new URL(started.url);
      assert.equal(authorize.origin + authorize.pathname, app.authorize);
      assert.equal(authorize.searchParams.get("state"), started.state);
      assert.ok(!authorize.searchParams.has("client_secret"));
      assert.equal(authorize.searchParams.get("redirect_uri"), `https://coach.example.com/app/api/integrations/oauth/${provider}/callback`);
      if (provider === "notion") assert.equal(authorize.searchParams.get("owner"), "user");
      if (provider === "zoom") {
        assert.match(authorize.searchParams.get("scope") || "", /cloud_recording:read:list_user_recordings/);
        assert.match(authorize.searchParams.get("scope") || "", /cloud_recording:read:meeting_transcript/);
        assert.equal(authorize.searchParams.get("code_challenge_method"), "S256");
      }
      if (provider === "google-calendar" || provider === "gmail" || provider === "google-meet") assert.equal(authorize.searchParams.get("access_type"), "offline");
      if (provider === "gmail") assert.match(authorize.searchParams.get("scope") || "", /gmail\.metadata/);
      if (provider === "google-meet") {
        const scope = authorize.searchParams.get("scope") || "";
        assert.match(scope, /meetings\.space\.readonly/);
        assert.match(scope, /drive\.meet\.readonly/);
        assert.match(scope, /contacts\.readonly/);
        assert.match(scope, /userinfo\.email/);
      }
      if (provider === "outlook") assert.match(authorize.searchParams.get("scope") || "", /Mail\.Read/);
      const previous = global.fetch;
      global.fetch = async (input, init) => {
        assert.equal(String(input), app.tokenOrigin + app.tokenPath);
        assert.equal(init?.redirect, "manual");
        const headers = init?.headers as Record<string, string>;
        const params = jsonProviders.has(provider) ? JSON.parse(String(init?.body)) : Object.fromEntries(new URLSearchParams(String(init?.body)));
        assert.equal(params.code, "one-use-code");
        assert.equal(params.redirect_uri, authorize.searchParams.get("redirect_uri"));
        if (app.pkce) assert.equal(createHash("sha256").update(params.code_verifier).digest("base64url"), authorize.searchParams.get("code_challenge"));
        if (basicProviders.has(provider)) {
          assert.match(headers.Authorization, /^Basic /);
          assert.equal(Buffer.from(headers.Authorization.slice(6), "base64").toString(), "app-id:app-secret");
          assert.equal(params.client_secret, undefined);
        } else { assert.equal(params.client_secret, "app-secret"); assert.equal(params.client_id, "app-id"); }
        return Response.json({ access_token: provider === "monday" ? jwt() : "account-token", ...(provider === "pipedrive" ? { api_domain: "https://sales.pipedrive.com" } : {}), token_type: provider === "slack" ? "bot" : provider === "airtable" ? "Bearer " : "Bearer",
          ...(!permanent.has(provider) ? { refresh_token: "refresh-token", ...(provider !== "monday" ? { expires_in: 3600 } : {}) } : {}),
          ...(provider === "slack" ? { ok: true, incoming_webhook: { url: hooks.slack } } : {}),
          ...(provider === "discord" ? { webhook: { url: hooks.discord } } : {}) });
      };
      try {
        await assert.rejects(finishOAuth(provider, "another-admin", started.state, started.state, "one-use-code"), /another workspace/);
        const result = await finishOAuth(provider, "admin", started.state, started.state, "one-use-code");
        assert.equal(result.body.autoSync, false);
        assert.equal(result.body.name, "My tool");
        if (provider === "slack" || provider === "discord") {
          assert.equal(result.secrets.webhookUrl, hooks[provider]);
          assert.equal(result.secrets.token, undefined);
        } else {
          assert.ok(result.secrets.token);
          if (permanent.has(provider)) {
            assert.equal(result.secrets.expiresAt, "");
            assert.deepEqual(await authorizedSecrets({ id: "not-stored", provider, secrets: result.secrets }), result.secrets);
          } else assert.ok(Number(result.secrets.expiresAt) > Date.now());
        }
        await assert.rejects(finishOAuth(provider, "admin", started.state, started.state, "one-use-code"), /another workspace/);
      } finally { global.fetch = previous; }
    }
  });
});

test("Slack failures, missing channel grants, and expiring tokens without refresh access fail safely", async () => {
  const { startOAuth, finishOAuth } = await import("./oauth");
  const original = global.fetch;
  try {
    for (const [provider, payload, message] of [
      ["slack", { ok: false, error: "app-secret must not leak" }, /invalid authorization/],
      ["discord", { access_token: "token" }, /Choose a channel/],
      ["linear", { access_token: "token", expires_in: 3600 }, /background access/],
      ["monday", { access_token: "invalid-jwt", refresh_token: "refresh" }, /invalid token expiration/],
    ] as const) {
      global.fetch = async () => Response.json(payload);
      const start = await startOAuth(provider, "admin", {}, "https://coach.example.com");
      await assert.rejects(finishOAuth(provider, "admin", start.state, start.state, "code"), message);
    }
  } finally { global.fetch = original; }
});

test("task OAuth saves no destination, blocks sync, browses projects, and verifies setup before enabling sync", async () => {
  const { runWithTenant } = await import("../tenant");
  const { connectIntegration, getConnection, disconnectIntegration } = await import("../revenue/connections");
  const { completeTaskSetup } = await import("../revenue/integration-setup");
  const { enqueueSync } = await import("../revenue/jobs");
  const previous = global.fetch;
  global.fetch = async (input, init) => {
    const url = new URL(String(input)); assert.equal((init?.headers as any).Authorization, "Bearer oauth-token");
    if (url.pathname.endsWith("/workspaces")) return Response.json({ data: [{ gid: "1", name: "Sales" }] });
    if (url.pathname.endsWith("/projects")) return Response.json({ data: [{ gid: "2", name: "Coaching" }], next_page: { offset: "page-2" } });
    if (url.pathname.endsWith("/projects/2")) return Response.json({ data: { gid: "2", name: "Coaching" } });
    return Response.json({}, { status: 403 });
  };
  try { await runWithTenant("org-task-setup", async () => {
    const id = await connectIntegration({ provider: "asana" }, "admin", { token: "oauth-token", authType: "oauth", expiresAt: "" });
    let connection = await getConnection(id);
    assert.equal(connection.config.pendingSetup, true); assert.equal(connection.config.autoSync, false);
    await assert.rejects(enqueueSync(id), /Choose a task destination/);
    const workspaces = await taskDestinations("asana", connection.secrets);
    assert.deepEqual(workspaces.items, [{ id: "1", label: "Sales", group: "workspace" }]);
    const projects = await taskDestinations("asana", connection.secrets, "workspace", "1");
    assert.equal(projects.nextCursor, "page-2");
    await assert.rejects(completeTaskSetup(id, { targetId: "3" }, "admin"), /permissions/);
    assert.equal((await getConnection(id)).config.pendingSetup, true);
    const race = await Promise.allSettled([completeTaskSetup(id, { targetId: "2", token: "attacker-token" }, "admin"), completeTaskSetup(id, { targetId: "2" }, "admin")]);
    assert.equal(race.filter(result => result.status === "fulfilled").length, 1);
    connection = await getConnection(id);
    assert.equal(connection.secrets.token, "oauth-token"); assert.equal(connection.secrets.targetId, "2");
    assert.equal(connection.config.pendingSetup, false); assert.equal(connection.config.autoSync, true); assert.equal(connection.config.targetLabel, "Coaching");
    assert.ok(await enqueueSync(id));
    await runWithTenant("other-org", () => assert.rejects(getConnection(id), /not found/));
    await disconnectIntegration(id, "admin"); await assert.rejects(completeTaskSetup(id, { targetId: "2" }, "admin"), /not found/);
  }); } finally { global.fetch = previous; }
});

test("OAuth task destinations use Bearer auth for ClickUp, Linear, monday and GitLab; manual tokens retain their headers", async () => {
  const original = global.fetch;
  const replies: Record<string, object> = {
    "api.clickup.com": { teams: [{ id: "1", name: "Sales" }] },
    "api.linear.app": { data: { teams: { nodes: [{ id: "team-id", name: "Sales" }], pageInfo: { hasNextPage: true, endCursor: "next" } } } },
    "api.monday.com": { data: { boards: [{ id: "1", name: "Sales" }] } },
    "gitlab.com": [{ id: 1, path_with_namespace: "sales/coaching", issues_enabled: true }],
  };
  global.fetch = async (input, init) => {
    const url = new URL(String(input)); const headers = init?.headers as Record<string, string>;
    assert.equal(headers.Authorization, "Bearer account-token"); assert.equal(headers["PRIVATE-TOKEN"], undefined);
    return Response.json(replies[url.hostname]);
  };
  try { for (const provider of ["clickup", "linear", "monday", "gitlab"] as const) assert.equal((await taskDestinations(provider, { token: "account-token", authType: "oauth" })).items.length, 1); }
  finally { global.fetch = original; }
});

test("Pipedrive OAuth sync and exports use Bearer auth while API-token connections stay compatible", async () => {
  const original = global.fetch; const seen: string[] = [];
  global.fetch = async (input, init) => {
    if ((init?.headers as Record<string, string>).Authorization) assert.equal(new URL(String(input)).hostname, "sales.pipedrive.com");
    const headers = init?.headers as Record<string, string>; seen.push(headers.Authorization || headers["x-api-token"]);
    return String(input).includes("/notes") ? Response.json({ success: true, data: { id: 123 } }) : Response.json({ data: [] });
  };
  try {
    await crmProviderPage("pipedrive", "oauth-token", {}, "org", "connection", true, "https://sales.pipedrive.com");
    await createCrmNote("pipedrive", "oauth-token", { kind: "deal", externalId: "1" }, { title: "Coaching", text: "Follow up", createdAt: new Date().toISOString() }, true, "https://sales.pipedrive.com");
    assert.ok(seen.every(value => value === "Bearer oauth-token"));
    seen.length = 0;
    await crmProviderPage("pipedrive", "api-token", {}, "org", "connection");
    assert.ok(seen.every(value => String(value) === "api-token"));
  } finally { global.fetch = original; }
});

test("CRM and task refresh rotates credentials across providers and preserves the GitLab redirect URI", async () => {
  const { db, ensureRevenueSchema } = await import("../db"); const { integrationConnections } = await import("../db/schema");
  const { encryptCredentials } = await import("../revenue/security"); const { getConnection } = await import("../revenue/connections");
  const { runWithTenant } = await import("../tenant"); const { authorizedSecrets } = await import("./oauth");
  await ensureRevenueSchema();
  await runWithTenant("org-generic-refresh", async () => {
    for (const provider of ["hubspot", "pipedrive", "asana", "notion", "monday", "linear", "todoist", "airtable", "github", "gitlab"] as const) {
      const id = `refresh-${provider}`; const redirectUri = `https://coach.example.com/app/api/integrations/oauth/${provider}/callback`;
      const now = new Date().toISOString();
      await db.insert(integrationConnections).values({ id, orgId: "org-generic-refresh", provider, name: provider, status: "connected", config: "{}", cursor: "{}", createdAt: now, updatedAt: now,
        credentials: encryptCredentials({ token: "expired", refreshToken: "rotate-me", authType: "oauth", expiresAt: "0", redirectUri, ...(provider === "pipedrive" ? { apiDomain: "https://sales.pipedrive.com" } : {}) }, `org-generic-refresh:${id}`) }).run();
      const original = global.fetch; let requests = 0;
      global.fetch = async (input, init) => {
        requests++; const app = OAUTH_APPS[provider]; assert.equal(String(input), app.tokenOrigin + app.tokenPath);
        const params = jsonProviders.has(provider) ? JSON.parse(String(init?.body)) : Object.fromEntries(new URLSearchParams(String(init?.body)));
        assert.equal(params.grant_type, "refresh_token"); assert.equal(params.refresh_token, "rotate-me");
        if (provider === "gitlab") assert.equal(params.redirect_uri, redirectUri);
        return Response.json({ access_token: provider === "monday" ? jwt() : "refreshed", refresh_token: "rotated", ...(provider === "pipedrive" ? { api_domain: "https://renamed.pipedrive.com" } : {}), ...(provider === "monday" ? {} : { expires_in: 3600 }), token_type: "Bearer" });
      };
      try {
        const connection = await getConnection(id);
        const results = await Promise.all(Array.from({ length: 8 }, () => authorizedSecrets(connection)));
        assert.equal(requests, 1, provider); assert.ok(results.every(secrets => secrets.refreshToken === "rotated"));
        const saved = await getConnection(id); assert.equal(saved.secrets.refreshToken, "rotated"); assert.equal(saved.secrets.redirectUri, redirectUri);
      } finally { global.fetch = original; }
    }
  });
});

test("Pipedrive OAuth API origins reject credential forwarding to untrusted destinations", async () => {
  const { pipedriveOrigin } = await import("./pipedrive");
  for (const value of [undefined, "https://attacker.example", "https://sales.pipedrive.com.attacker.example", "http://sales.pipedrive.com", "https://user:pass@sales.pipedrive.com", "https://sales.pipedrive.com/api", "https://sales.pipedrive.com?token=secret", "https://sales.pipedrive.com:444"]) assert.throws(() => pipedriveOrigin(value));
  assert.equal(pipedriveOrigin("https://sales.pipedrive.com/"), "https://sales.pipedrive.com");
});

test("destination browsing handles Airtable title fields, shared Notion data sources, ClickUp folders and cursor pages", async () => {
  const original = global.fetch; const secrets = { token: "account-token", authType: "oauth" };
  global.fetch = async (input, init) => {
    const url = new URL(String(input)); assert.equal((init?.headers as any).Authorization, "Bearer account-token");
    if (url.hostname === "api.airtable.com") {
      if (url.pathname.endsWith("/bases")) return Response.json({ bases: [{ id: "appSales", name: "Sales" }], offset: "next-base" });
      assert.equal(url.pathname, "/v0/meta/bases/appSales/tables");
      return Response.json({ tables: [{ id: "tblCoaching", name: "Coaching", primaryFieldId: "fldTitle", fields: [{ id: "fldTitle", name: "Action" }] }] });
    }
    if (url.hostname === "api.notion.com") {
      const body = JSON.parse(String(init?.body)); assert.deepEqual(body.filter, { property: "object", value: "data_source" });
      assert.equal(body.start_cursor, "next-notion");
      return Response.json({ results: [{ id: "shared-source", title: [{ plain_text: "Coaching" }] }], has_more: false });
    }
    if (url.hostname === "api.todoist.com") {
      assert.equal(url.searchParams.get("cursor"), "next-project");
      return Response.json({ results: [{ id: "1", name: "Coaching" }], next_cursor: "more-projects" });
    }
    if (url.hostname === "api.github.com") return Response.json([{ full_name: "sales/coaching", has_issues: true }, { full_name: "sales/archived", archived: true }]);
    if (url.hostname === "api.clickup.com") {
      if (url.pathname.endsWith("/space")) return Response.json({ spaces: [{ id: "2", name: "Sales" }] });
      if (url.pathname.endsWith("/folder")) return Response.json({ folders: [{ id: "3", name: "Coaching" }] });
      return Response.json({ lists: [{ id: "4", name: "Follow-ups" }] });
    }
    throw new Error("Unexpected destination host");
  };
  try {
    const bases = await taskDestinations("airtable", secrets); assert.equal(bases.nextCursor, "next-base"); assert.equal(bases.items[0].group, "base");
    const tables = await taskDestinations("airtable", secrets, "base", "appSales"); assert.deepEqual(tables.items[0].fields, { baseId: "appSales", titleField: "Action" });
    assert.equal((await taskDestinations("notion", secrets, "", "", "next-notion")).items[0].label, "Coaching");
    assert.equal((await taskDestinations("todoist", secrets, "", "", "next-project")).nextCursor, "more-projects");
    assert.equal((await taskDestinations("github", secrets)).items.length, 1);
    assert.equal((await taskDestinations("clickup", secrets, "team", "1")).items[0].group, "space");
    const contents = await taskDestinations("clickup", secrets, "space", "2"); assert.equal(contents.items[0].group, "folder"); assert.equal(contents.items[1].id, "4");
    assert.equal((await taskDestinations("clickup", secrets, "folder", "3")).items[0].id, "4");
    await assert.rejects(taskDestinations("airtable", secrets, "base", "https://attacker.example"), /Choose an Airtable base/);
    await assert.rejects(taskDestinations("clickup", secrets, "space", "../other"), /Choose a ClickUp/);
  } finally { global.fetch = original; }
});
