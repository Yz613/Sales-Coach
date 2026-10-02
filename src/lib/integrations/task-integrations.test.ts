import assert from "node:assert/strict";
import { test, after } from "node:test";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { TASK_TOOLS } from "./task-catalog";
import { taskProviderPage, normalizeTask } from "./tasks";
import { discordWebhook } from "./slack";
import type { TaskProvider } from "../revenue/types";

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "sales-task-stress-"));
process.env.SALES_COACH_DB_PATH = path.join(directory, "test.db"); process.env.INTEGRATION_ENCRYPTION_KEY = randomBytes(32).toString("base64"); process.env.PUBLIC_APP_URL = "https://coach.example.com";
after(() => fs.rmSync(directory, { recursive: true, force: true }));
const vendors: Record<string, TaskProvider> = { "app.asana.com": "asana", "api.notion.com": "notion", "api.trello.com": "trello", "api.clickup.com": "clickup", "api.monday.com": "monday", "api.linear.app": "linear", "api.todoist.com": "todoist", "api.airtable.com": "airtable", "api.github.com": "github", "gitlab.com": "gitlab" };
const writes: { provider: string; body: any }[] = []; let fault = 0; let malformed = false; let lostResponse = false; let repeatedCursor = false; let count = 450; let discordRateLimited = false;
function fixture(provider: TaskProvider, index: number): any {
  const base = { id: String(index + 1), gid: String(index + 1), name: `Follow-up ${index}`, title: `Follow-up ${index}`, description: "Contact the customer", url: `https://example.com/task/${index}`, completed: index % 2 === 0 };
  if (provider === "notion") return { ...base, properties: { "Task name": { type: "title", title: [{ plain_text: base.name }] }, Status: { type: "status", status: { name: base.completed ? "Done" : "In progress" } } } };
  if (provider === "trello") return { ...base, desc: base.description, dueComplete: base.completed };
  if (provider === "clickup") return { ...base, status: { type: base.completed ? "closed" : "open" } };
  if (provider === "monday") return { ...base, state: "active", column_values: [{ type: "status", text: base.completed ? "Done" : "Working" }] };
  if (provider === "linear") return { ...base, state: { type: base.completed ? "completed" : "started" } };
  if (provider === "todoist") return { ...base, content: base.name, checked: base.completed };
  if (provider === "airtable") return { ...base, fields: { Name: base.name, Status: base.completed ? "Done" : "Open" } };
  if (["github", "gitlab"].includes(provider)) return { ...base, number: index + 1, iid: index + 1, state: base.completed ? "closed" : "open", html_url: base.url, web_url: base.url };
  return base;
}
async function vendorFetch(input: any, init?: RequestInit) {
  const url = new URL(String(input)); assert.equal(init?.redirect, "manual"); assert.ok(!url.searchParams.has("token") && !url.searchParams.has("key"));
  if (url.hostname === "discord.com") {
    assert.equal(url.searchParams.get("wait"), "true"); const body = JSON.parse(String(init?.body)); assert.deepEqual(body.allowed_mentions, { parse: [] });
    if (discordRateLimited) return Response.json({ retry_after: 120 }, { status: 429 });
    writes.push({ provider: "discord", body }); return Response.json({ id: "message-1" });
  }
  const provider = vendors[url.hostname]; assert.ok(provider, "Only simulated fixed provider hosts are used");
  const h = init?.headers as Record<string, string>;
  assert.equal(provider === "gitlab" ? h["PRIVATE-TOKEN"] : h.Authorization, provider === "trello" ? 'OAuth oauth_consumer_key="api-key", oauth_token="api-token"' : ["monday", "linear", "clickup"].includes(provider) || provider === "gitlab" ? "api-token" : "Bearer api-token");
  if (provider === "notion") assert.equal(h["Notion-Version"], "2025-09-03");
  if (provider === "github") assert.equal(h["X-GitHub-Api-Version"], "2026-03-10");
  const body = init?.body ? JSON.parse(String(init.body)) : {};
  const create = init?.method === "POST" && (provider === "monday" || provider === "linear" ? body.query.startsWith("mutation") : !url.pathname.endsWith("/query"));
  if (create) {
    if (fault) return new Response("api-token must stay secret", { status: fault, headers: { "Retry-After": "120" } });
    writes.push({ provider, body }); if (lostResponse) throw new TypeError("Network interrupted after acceptance");
    const raw = fixture(provider, 9000);
    if (provider === "asana") { assert.deepEqual(body.data.projects, ["123"]); return Response.json({ data: raw }); }
    if (provider === "notion") { assert.equal(body.parent.data_source_id, "source-id"); assert.ok(body.properties["Task name"]); return Response.json(raw); }
    if (provider === "trello") { assert.equal(body.idList, "list-id"); return Response.json(raw); }
    if (provider === "monday") return Response.json({ data: { create_item: raw } });
    if (provider === "linear") return Response.json({ data: { issueCreate: { success: true, issue: raw } } });
    return Response.json(raw);
  }
  if (provider === "asana" && !url.pathname.endsWith("/tasks")) return Response.json({ data: { gid: "123", name: "Coaching" } });
  if (provider === "notion" && url.pathname.includes("/databases/")) return Response.json({ data_sources: [{ id: "source-id" }] });
  if (provider === "notion" && !url.pathname.endsWith("/query")) return Response.json({ properties: { "Task name": { type: "title" } }, title: [{ plain_text: "Coaching" }] });
  if (provider === "trello" && url.pathname.includes("/lists/")) return Response.json({ idBoard: "board-id", closed: false });
  if (provider === "trello" && !url.pathname.includes("/cards/")) return Response.json({ id: "board-id", name: "Coaching" });
  if (provider === "clickup" && !url.pathname.endsWith("/task")) return Response.json({ id: "123", name: "Coaching" });
  if (provider === "todoist" && !url.pathname.endsWith("/tasks")) return Response.json({ id: "project-id", name: "Coaching" });
  if (["github", "gitlab"].includes(provider) && !url.pathname.endsWith("/issues")) return Response.json({ id: 123, name: "Coaching", has_issues: true, issues_enabled: true });
  if (["monday", "linear"].includes(provider) && body.query.includes("Verify")) return Response.json({ data: provider === "monday" ? { boards: [{ id: "123", name: "Coaching" }] } : { team: { id: "team-id", name: "Coaching" } } });
  if (fault) return new Response("api-token must stay secret", { status: fault, headers: { "Retry-After": "120" } });
  if (malformed) return Response.json({ data: {}, results: {}, records: {}, tasks: {} });
  const offset = provider === "clickup" ? Number(url.searchParams.get("page") || 0) * 100 : ["github", "gitlab"].includes(provider) ? (Number(url.searchParams.get("page") || 1) - 1) * 100
    : Number(url.searchParams.get("offset") || url.searchParams.get("cursor") || body.start_cursor || body.variables?.after || body.variables?.cursor || 0);
  const rows = Array.from({ length: Math.max(0, Math.min(provider === "trello" ? count : 100, count - offset)) }, (_, i) => fixture(provider, offset + i));
  const next = offset + rows.length < count ? repeatedCursor ? "100" : String(offset + rows.length) : undefined;
  if (provider === "asana") return Response.json({ data: rows, next_page: next ? { offset: next } : null });
  if (provider === "notion") return Response.json({ results: rows, has_more: Boolean(next), next_cursor: next });
  if (provider === "clickup") return Response.json({ tasks: rows, last_page: !next });
  if (provider === "monday") { const page = { items: rows, cursor: next }; return Response.json({ data: body.variables.cursor ? { next_items_page: page } : { boards: [{ items_page: page }] } }); }
  if (provider === "linear") return Response.json({ data: { team: { issues: { nodes: rows, pageInfo: { hasNextPage: Boolean(next), endCursor: next } } } } });
  if (provider === "todoist") return Response.json({ results: rows, next_cursor: next });
  if (provider === "airtable") return Response.json({ records: rows, offset: next });
  return Response.json(rows);
}
async function withVendors(fn: () => Promise<void>) { const original = global.fetch; global.fetch = vendorFetch; try { await fn(); } finally { global.fetch = original; fault = 0; lostResponse = false; repeatedCursor = false; count = 450; } }
function credentials(provider: string) { return { provider, token: "api-token", apiKey: "api-key", listId: "list-id", baseId: "app123", targetId: ["asana", "clickup", "monday"].includes(provider) ? "123" : provider === "github" ? "owner/repo" : provider === "gitlab" ? "group/project" : provider === "linear" ? "team-id" : "project-id" }; }
async function drain(orgId: string) {
  const { processJobs } = await import("../revenue/jobs");
  for (let round = 0; round < 100; round++) { const results = await Promise.all(Array.from({ length: 4 }, () => processJobs(orgId, 10))); if (!results.flat().length) return; }
  assert.fail("Jobs did not finish within the bounded stress run");
}

test("ten task providers import 4,500 tasks through concurrent workers, deduplicate replay, export follow-ups once, and isolate tenants", async () => withVendors(async () => {
  const { runWithTenant } = await import("../tenant"); const { connectIntegration, getConnection } = await import("../revenue/connections");
  const { enqueueSync, enqueueJob } = await import("../revenue/jobs"); const { taskWorkspace, queueTaskExport } = await import("../revenue/tasks");
  const { importMeeting } = await import("../revenue/imports"); const { normalizedMeeting } = await import("./meeting");
  const { db } = await import("../db"); const { externalTasks, processingJobs } = await import("../db/schema"); const { and, eq, count: sqlCount } = await import("drizzle-orm");
  await runWithTenant("org-task-stress", async () => {
    const call = await importMeeting({ id: "coaching", provider: "zapier", config: { defaultStage: "Discovery" } }, normalizedMeeting({ externalId: "call-1", transcriptText: "Rep: Send the proposal.", actionItems: [{ id: "action-1", description: "Send proposal", completed: false }] }));
    const ids: string[] = [];
    for (const tool of TASK_TOOLS) { const id = await connectIntegration(credentials(tool.id), "admin"); ids.push(id); await enqueueSync(id); }
    await drain("org-task-stress");
    for (const id of ids) assert.equal((await db.select({ count: sqlCount() }).from(externalTasks).where(eq(externalTasks.connectionId, id)).get()).count, 450);
    assert.equal((await db.select({ count: sqlCount() }).from(externalTasks).where(eq(externalTasks.orgId, "org-task-stress")).get()).count, 4500);
    for (const id of ids) {
      await enqueueJob({ kind: "sync", connectionId: id, payload: { syncStartedAt: new Date().toISOString() }, key: `${id}:replay` });
      const deliveries = await Promise.all(Array.from({ length: 30 }, () => queueTaskExport(id, call.callId, "action-1", "admin")));
      assert.equal(new Set(deliveries.map(value => value.jobId)).size, 1);
    }
    await drain("org-task-stress");
    assert.equal(writes.length, 10);
    for (const id of ids) { const data = await taskWorkspace(id); assert.equal(data.exports.length, 1); assert.equal(data.exports[0].status, "completed"); assert.equal((await getConnection(id)).status, "connected"); }
    assert.equal((await db.select().from(processingJobs).where(and(eq(processingJobs.orgId, "org-task-stress"), inStatus("failed"))).all()).length, 0);
    await runWithTenant("org-unrelated", async () => { assert.deepEqual(await taskWorkspace(ids[0]), { tasks: [], exports: [], actionItems: [] }); await assert.rejects(() => queueTaskExport(ids[0], call.callId, "action-1", "admin"), /not found/); });
  });
  function inStatus(status: string) { return eq(processingJobs.status, status); }
}));

test("all task APIs reject malformed lists, stop repeating cursors and expose errors without leaking credentials", async () => withVendors(async () => {
  count = 300; repeatedCursor = true;
  for (const tool of TASK_TOOLS) {
    const secrets = credentials(tool.id);
    if (!["trello", "github", "gitlab", "clickup"].includes(tool.id)) await assert.rejects(() => taskProviderPage(tool.id as TaskProvider, secrets, { after: "100" }), /repeated/);
    fault = 401; await assert.rejects(() => taskProviderPage(tool.id as TaskProvider, secrets, {}), error => { assert.ok(error instanceof Error); assert.ok(!error.message.includes("api-token")); return true; }); fault = 0;
    if (tool.id !== "trello") await assert.rejects(() => taskProviderPage(tool.id as TaskProvider, secrets, { pageCount: 99 }), /100 pages/);
    malformed = true; await assert.rejects(() => taskProviderPage(tool.id as TaskProvider, secrets, {}), /invalid|oversized/); malformed = false;
  }
}));

test("export throttling retries safely, uncertain outcomes require confirmation, and revoked connections cancel pending writes", async () => withVendors(async () => {
  const { runWithTenant } = await import("../tenant"); const { connectIntegration, disconnectIntegration } = await import("../revenue/connections");
  const { queueTaskExport, retryTaskExport, taskWorkspace } = await import("../revenue/tasks"); const { processJobs } = await import("../revenue/jobs");
  const { importMeeting } = await import("../revenue/imports"); const { normalizedMeeting } = await import("./meeting");
  const { db } = await import("../db"); const { processingJobs } = await import("../db/schema"); const { eq } = await import("drizzle-orm");
  await runWithTenant("org-task-failures", async () => {
    const id = await connectIntegration(credentials("asana"), "admin");
    const call = await importMeeting({ id: "coaching", provider: "zapier", config: { defaultStage: "Discovery" } }, normalizedMeeting({ externalId: "failure-call", transcriptText: "Rep: Follow up.", actionItems: Array.from({ length: 3 }, (_, i) => ({ id: `a${i}`, description: `Follow up ${i}`, completed: false })) }));
    const throttled = await queueTaskExport(id, call.callId, "a0", "admin"); fault = 429; assert.equal((await processJobs("org-task-failures", 1, [throttled.jobId]))[0].status, "queued"); fault = 0;
    await db.update(processingJobs).set({ availableAt: new Date().toISOString() }).where(eq(processingJobs.id, throttled.jobId)).run();
    assert.equal((await processJobs("org-task-failures", 1, [throttled.jobId]))[0].status, "completed");
    const uncertain = await queueTaskExport(id, call.callId, "a1", "admin"); lostResponse = true; const before = writes.length;
    assert.equal((await processJobs("org-task-failures", 1, [uncertain.jobId]))[0].status, "failed"); lostResponse = false;
    assert.equal(writes.length, before + 1); assert.equal((await taskWorkspace(id)).exports.find((item: any) => item.id === uncertain.exportId).status, "uncertain");
    await assert.rejects(() => retryTaskExport(id, uncertain.exportId, false, "admin"), /confirm/);
    const retried = await retryTaskExport(id, uncertain.exportId, true, "admin"); await processJobs("org-task-failures", 1, [retried.jobId]);
    const pending = await queueTaskExport(id, call.callId, "a2", "admin"); await disconnectIntegration(id, "admin"); const wrote = writes.length;
    assert.deepEqual(await processJobs("org-task-failures", 1, [pending.jobId]), []); assert.equal(writes.length, wrote);
  });
}));

test("Discord alerts remain opt-in, disable mentions, coalesce duplicate bursts, honor rate limits and stop after disconnect", async () => withVendors(async () => {
  for (const url of ["http://discord.com/api/webhooks/1/token", "https://evil.test/api/webhooks/1/token", "https://discord.com/api/webhooks/1/token?redirect=evil", "https://discord.com/api/webhooks/1/token/other"]) assert.throws(() => discordWebhook(url));
  const { runWithTenant } = await import("../tenant"); const { connectIntegration, getConnection, saveConnectionConfig, disconnectIntegration } = await import("../revenue/connections");
  const { queueSlackAlerts } = await import("./slack"); const { enqueueJob, processJobs } = await import("../revenue/jobs");
  const { importMeeting } = await import("../revenue/imports"); const { normalizedMeeting } = await import("./meeting"); const { updateConversation } = await import("../revenue/conversations"); const { getCallById } = await import("../db/service");
  const { db } = await import("../db"); const { processingJobs } = await import("../db/schema"); const { eq } = await import("drizzle-orm");
  await runWithTenant("org-discord", async () => {
    const id = await connectIntegration({ provider: "discord", webhookUrl: "https://discord.com/api/webhooks/123/secret" }, "admin"); const before = writes.length;
    const imported = await importMeeting({ id: "feed", provider: "make", config: { defaultStage: "Discovery" } }, normalizedMeeting({ externalId: "one", transcriptText: "Rep: Hello." }));
    await queueSlackAlerts("reviewed", imported.callId, "off"); await drain("org-discord"); assert.equal(writes.length, before);
    const connection = await getConnection(id); await saveConnectionConfig(id, { ...connection.config, notifyReviewed: true });
    const call = await getCallById(imported.callId); assert.ok(call); await updateConversation({ isAdmin: true, userId: "admin", canViewAllCalls: true } as any, call, { action: "review", reviewed: true });
    await Promise.all(Array.from({ length: 300 }, () => queueSlackAlerts("reviewed", call.id, "burst"))); await drain("org-discord"); assert.equal(writes.length, before + 2);
    const jobId = await enqueueJob({ kind: "notify-slack", connectionId: id, payload: { event: "test" }, key: "discord-limit" }); discordRateLimited = true;
    assert.equal((await processJobs("org-discord", 1, [jobId]))[0].status, "queued"); discordRateLimited = false;
    await db.update(processingJobs).set({ availableAt: new Date().toISOString() }).where(eq(processingJobs.id, jobId)).run(); assert.equal((await processJobs("org-discord", 1, [jobId]))[0].status, "completed");
    const revoked = await enqueueJob({ kind: "notify-slack", connectionId: id, payload: { event: "test" }, key: "revoked" }); await disconnectIntegration(id, "admin"); assert.deepEqual(await processJobs("org-discord", 1, [revoked]), []);
  });
}));

test("all ten task providers preserve saved data after failed snapshots and distinguish throttling from rejected writes", async () => withVendors(async () => {
  const { runWithTenant } = await import("../tenant"); const { connectIntegration } = await import("../revenue/connections");
  const { queueTaskExport, storeExternalTask } = await import("../revenue/tasks"); const { enqueueJob, processJobs } = await import("../revenue/jobs");
  const { importMeeting } = await import("../revenue/imports"); const { normalizedMeeting } = await import("./meeting");
  const { db } = await import("../db"); const { processingJobs, externalTasks, taskExports } = await import("../db/schema"); const { eq, and } = await import("drizzle-orm");
  await runWithTenant("org-task-errors", async () => {
    const call = await importMeeting({ id: "feed", provider: "zapier", config: { defaultStage: "Discovery" } }, normalizedMeeting({ externalId: "error-call", transcriptText: "Rep: Follow up.", actionItems: [{ id: "retry", description: "Follow up", completed: false }, { id: "reject", description: "Share proposal", completed: false }] }));
    for (const tool of TASK_TOOLS) {
      const id = await connectIntegration(credentials(tool.id), "admin");
      await storeExternalTask({ id, provider: tool.id }, normalizeTask(tool.id as TaskProvider, fixture(tool.id as TaskProvider, 0)));
      await db.update(externalTasks).set({ syncedAt: "2000-01-01T00:00:00Z" }).where(eq(externalTasks.connectionId, id)).run();
      const snapshot = await enqueueJob({ kind: "sync", connectionId: id, payload: { syncStartedAt: new Date().toISOString() }, key: `failed-snapshot:${id}` });
      fault = 503; assert.equal((await processJobs("org-task-errors", 1, [snapshot]))[0].status, "queued"); fault = 0;
      assert.notEqual((await db.select().from(externalTasks).where(eq(externalTasks.connectionId, id)).get()).status, "archived");
      const retry = await queueTaskExport(id, call.callId, "retry", "admin"); fault = 429;
      assert.equal((await processJobs("org-task-errors", 1, [retry.jobId]))[0].status, "queued"); fault = 0;
      await db.update(processingJobs).set({ availableAt: new Date().toISOString() }).where(eq(processingJobs.id, retry.jobId)).run();
      assert.equal((await processJobs("org-task-errors", 1, [retry.jobId]))[0].status, "completed");
      const rejected = await queueTaskExport(id, call.callId, "reject", "admin"); fault = 401;
      assert.equal((await processJobs("org-task-errors", 1, [rejected.jobId]))[0].status, "failed"); fault = 0;
      const result = await db.select().from(taskExports).where(and(eq(taskExports.id, rejected.exportId), eq(taskExports.orgId, "org-task-errors"))).get();
      assert.equal(result.status, "failed"); assert.ok(!result.lastError.includes("api-token"));
    }
  });
}));

test("completed or deleted source actions cannot be delivered, and deletion removes coaching delivery metadata", async () => withVendors(async () => {
  const { runWithTenant } = await import("../tenant"); const { connectIntegration } = await import("../revenue/connections");
  const { queueTaskExport, taskWorkspace, storeExternalTask } = await import("../revenue/tasks"); const { processJobs } = await import("../revenue/jobs");
  const { deleteConversation } = await import("../revenue/privacy"); const { importMeeting } = await import("../revenue/imports"); const { normalizedMeeting } = await import("./meeting");
  const { db } = await import("../db"); const { callMetadata, externalTasks } = await import("../db/schema"); const { eq } = await import("drizzle-orm");
  await runWithTenant("org-task-deletion", async () => {
    const id = await connectIntegration(credentials("asana"), "admin");
    const call = await importMeeting({ id: "feed", provider: "zapier", config: { defaultStage: "Discovery" } }, normalizedMeeting({ externalId: "delete-me", transcriptText: "Rep: Follow up.", actionItems: [{ id: "a", description: "Completed later", completed: false }, { id: "b", description: "Deleted later", completed: false }] }));
    const queued = await queueTaskExport(id, call.callId, "a", "admin");
    await db.update(callMetadata).set({ actionItems: JSON.stringify([{ id: "a", description: "Completed later", completed: true }, { id: "b", description: "Deleted later", completed: false }]) }).where(eq(callMetadata.callId, call.callId)).run();
    const before = writes.length; await processJobs("org-task-deletion", 1, [queued.jobId]); assert.equal(writes.length, before);
    assert.equal((await taskWorkspace(id)).exports[0].status, "cancelled");
    const deleted = await queueTaskExport(id, call.callId, "b", "admin");
    await storeExternalTask({ id, provider: "asana" }, normalizeTask("asana", fixture("asana", 0)), call.callId);
    await deleteConversation(call.callId, "admin"); assert.deepEqual(await processJobs("org-task-deletion", 1, [deleted.jobId]), []);
    assert.equal((await taskWorkspace(id)).exports.length, 0); assert.equal((await db.select().from(externalTasks).where(eq(externalTasks.connectionId, id)).get()).callId, null); assert.equal(writes.length, before);
    await assert.rejects(() => queueTaskExport(id, call.callId, "b", "admin"), /not found/);
  });
  for (const provider of ["github", "gitlab"] as const) assert.throws(() => normalizeTask(provider, { title: "Missing ID" }), /invalid item ID/);
}));

test("task normalization keeps unrelated Notion checkboxes open and preserves safe issue IDs", () => {
  assert.equal(normalizeTask("asana", { gid: "dated", due_on: "2026-10-02" }).dueAt, "2026-10-02");
  assert.equal(normalizeTask("asana", { gid: "timed", due_at: "2026-10-02T16:00:00Z" }).dueAt, "2026-10-02T16:00:00.000Z");
  const page = { id: "page", properties: { Approved: { type: "checkbox", checkbox: true } } };
  assert.equal(normalizeTask("notion", page).status, "open");
  assert.equal(normalizeTask("notion", { ...page, properties: { Done: { type: "checkbox", checkbox: true } } }).status, "completed");
  assert.equal(normalizeTask("github", { number: 21, title: "Follow up" }).externalId, "21");
  assert.equal(normalizeTask("gitlab", { iid: 22, title: "Follow up" }).externalId, "22");
});
