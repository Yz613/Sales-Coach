import assert from "node:assert/strict";
import { after, test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createApiToken, authenticateApiToken, revokeApiToken, listApiTokens } from "./apiTokens";
import { executeTool, MCP_TOOL_DEFINITIONS } from "./mcp/tools";
import type { AuthUser } from "./auth";
import { runWithTenant, LOCAL_TENANT_ID } from "./tenant";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sales-mcp-"));
process.env.SALES_COACH_DB_PATH = path.join(dir, "test.db");
after(() => fs.rmSync(dir, { recursive: true, force: true }));

const testAuth: AuthUser = {
  userId: "user-123",
  role: "admin",
  isAdmin: true,
  isMember: false,
  isClerkConfigured: false,
  canViewAllCalls: true,
  tenantId: "tenant-mcp-test",
  orgId: "tenant-mcp-test",
  clerkPlanId: null,
  billingPaid: true,
  name: "Test Admin",
};

test("API Token lifecycle: create, authenticate, list, and revoke", async () => {
  const { db, ensureRevenueSchema } = await import("./db");
  await ensureRevenueSchema();

  // Create token
  const created = await createApiToken("Grokbot Production", testAuth);
  assert.ok(created.token.startsWith("sc_live_"));
  assert.equal(created.name, "Grokbot Production");
  assert.ok(created.prefix.startsWith("sc_live_"));

  // Authenticate with Bearer
  const auth1 = await authenticateApiToken(`Bearer ${created.token}`);
  assert.ok(auth1, "Token should authenticate successfully");
  assert.equal(auth1.orgId, "tenant-mcp-test");
  assert.equal(auth1.userId, "user-123");
  assert.equal(auth1.isAdmin, true);

  // Authenticate without Bearer prefix
  const auth2 = await authenticateApiToken(created.token);
  assert.ok(auth2, "Direct token string should authenticate");

  // List tokens
  const list = await listApiTokens(testAuth);
  assert.ok(list.length >= 1);
  const found = list.find((t) => t.id === created.id);
  assert.ok(found);
  assert.equal(found?.name, "Grokbot Production");

  // Reject invalid token
  const invalidAuth = await authenticateApiToken("sc_live_invalid_garbage_token");
  assert.equal(invalidAuth, null);

  // Revoke token
  const revoked = await revokeApiToken(created.id, testAuth);
  assert.equal(revoked, true);

  // Revoked token should fail authentication
  const revokedAuth = await authenticateApiToken(created.token);
  assert.equal(revokedAuth, null);
});

test("API Token ownership: non-admin member cannot list or revoke another user's tokens", async () => {
  const user1: AuthUser = {
    userId: "user-alice",
    role: "member",
    isAdmin: false,
    isMember: true,
    isClerkConfigured: false,
    canViewAllCalls: false,
    tenantId: "tenant-mcp-test",
    orgId: "tenant-mcp-test",
    clerkPlanId: null,
    billingPaid: true,
    name: "Alice",
  };

  const user2: AuthUser = {
    userId: "user-bob",
    role: "member",
    isAdmin: false,
    isMember: true,
    isClerkConfigured: false,
    canViewAllCalls: false,
    tenantId: "tenant-mcp-test",
    orgId: "tenant-mcp-test",
    clerkPlanId: null,
    billingPaid: true,
    name: "Bob",
  };

  const aliceToken = await createApiToken("Alice Bot", user1);
  const bobToken = await createApiToken("Bob Bot", user2);

  // Alice lists tokens -> should only see her own
  const aliceList = await listApiTokens(user1);
  assert.ok(aliceList.some((t) => t.id === aliceToken.id));
  assert.ok(!aliceList.some((t) => t.id === bobToken.id));

  // Bob lists tokens -> should only see his own
  const bobList = await listApiTokens(user2);
  assert.ok(bobList.some((t) => t.id === bobToken.id));
  assert.ok(!bobList.some((t) => t.id === aliceToken.id));

  // Admin lists tokens -> sees both
  const adminList = await listApiTokens(testAuth);
  assert.ok(adminList.some((t) => t.id === aliceToken.id));
  assert.ok(adminList.some((t) => t.id === bobToken.id));

  // Alice attempts to revoke Bob's token -> fails / does nothing
  const aliceRevokedBob = await revokeApiToken(bobToken.id, user1);
  // Bob's token should still be active
  const bobAuth = await authenticateApiToken(bobToken.token);
  assert.ok(bobAuth, "Bob's token should not have been revoked by Alice");

  // Bob revokes Bob's token -> succeeds
  await revokeApiToken(bobToken.id, user2);
  const bobAuthAfter = await authenticateApiToken(bobToken.token);
  assert.equal(bobAuthAfter, null);

  // Cleanup Alice token
  await revokeApiToken(aliceToken.id, user1);
});

test("MCP Tool definitions include all required tools with schemas", () => {
  const toolNames = MCP_TOOL_DEFINITIONS.map((t) => t.name);
  assert.ok(toolNames.includes("query_calls"));
  assert.ok(toolNames.includes("get_forecast"));
  assert.ok(toolNames.includes("get_call_details"));
  assert.ok(toolNames.includes("get_rep_performance"));
  assert.ok(toolNames.includes("ask_sales_coach"));

  const queryCallsTool = MCP_TOOL_DEFINITIONS.find((t) => t.name === "query_calls");
  assert.ok(queryCallsTool?.inputSchema.properties.minScore);
  assert.ok(queryCallsTool?.inputSchema.properties.maxScore);
  assert.ok(queryCallsTool?.inputSchema.properties.stage);
});

test("query_calls filters calls by minScore and computes count and averages", async () => {
  const { db, ensureRevenueSchema } = await import("./db");
  const schema = await import("./db/schema");
  await ensureRevenueSchema();

  const orgId = "tenant-mcp-test";

  // Seed rep
  const repId = "rep-mcp-1";
  await db.insert(schema.reps).values({
    id: repId,
    orgId,
    name: "Sam Sales",
    email: "sam@example.com",
    role: "Senior AE",
    createdAt: new Date().toISOString(),
  }).onConflictDoNothing().run();

  // Seed call 1 (Score: 8)
  const call1Id = "call-mcp-high";
  await db.insert(schema.calls).values({
    id: call1Id,
    orgId,
    repId,
    prospectCompany: "Acme Corp",
    prospectName: "Alice Prospect",
    callStage: "Discovery",
    coreOutcome: "Advanced to Demo",
    durationSeconds: 1800,
    transcriptText: "Alice: We need this solution badly.\nSam: We can deploy this week.",
    status: "completed",
    createdAt: new Date().toISOString(),
  }).onConflictDoNothing().run();

  await db.insert(schema.evaluations).values({
    id: "eval-mcp-high",
    orgId,
    callId: call1Id,
    repId,
    bottomLine: "Excellent qualification and clear next steps.",
    painStatus: "Pass",
    painEvidence: "Customer stated critical need.",
    budgetStatus: "Pass",
    budgetEvidence: "Budget verified for Q4.",
    decisionStatus: "Pass",
    decisionEvidence: "Alice is economic buyer.",
    scriptAdherenceScore: 8,
    scriptFeedback: "Great job maintaining flow.",
    missedOpportunities: "[]",
    topFixes: "[]",
    createdAt: new Date().toISOString(),
  }).onConflictDoNothing().run();

  // Seed call 2 (Score: 4)
  const call2Id = "call-mcp-low";
  await db.insert(schema.calls).values({
    id: call2Id,
    orgId,
    repId,
    prospectCompany: "Beta Inc",
    prospectName: "Bob Buyer",
    callStage: "Discovery",
    coreOutcome: "Follow-up needed",
    durationSeconds: 900,
    transcriptText: "Bob: Not sure about this.\nSam: Okay bye.",
    status: "completed",
    createdAt: new Date().toISOString(),
  }).onConflictDoNothing().run();

  await db.insert(schema.evaluations).values({
    id: "eval-mcp-low",
    orgId,
    callId: call2Id,
    repId,
    bottomLine: "Rep gave up too early without exploring budget.",
    painStatus: "Fail",
    painEvidence: "No pain explored.",
    budgetStatus: "Fail",
    budgetEvidence: "Budget not asked.",
    decisionStatus: "Incomplete",
    decisionEvidence: "Decision criteria unknown.",
    scriptAdherenceScore: 4,
    scriptFeedback: "Probe deeper into pain points.",
    missedOpportunities: "[]",
    topFixes: "[]",
    createdAt: new Date().toISOString(),
  }).onConflictDoNothing().run();

  // Test query_calls with minScore: 5 ("calls ranked above a 5")
  const resultAbove5 = await runWithTenant(orgId, () =>
    executeTool("query_calls", { minScore: 5 }, testAuth)
  );

  assert.equal(resultAbove5.data.totalCount, 1);
  assert.equal(resultAbove5.data.calls[0].id, call1Id);
  assert.equal(resultAbove5.data.calls[0].score, 8);
  assert.ok(resultAbove5.text.includes("Found 1 calls ranked at or above 5"));

  // Test query_calls with maxScore: 5
  const resultBelow5 = await runWithTenant(orgId, () =>
    executeTool("query_calls", { maxScore: 5 }, testAuth)
  );

  assert.equal(resultBelow5.data.totalCount, 1);
  assert.equal(resultBelow5.data.calls[0].id, call2Id);
  assert.equal(resultBelow5.data.calls[0].score, 4);

  // Test query_calls with no filter (returns all)
  const resultAll = await runWithTenant(orgId, () =>
    executeTool("query_calls", {}, testAuth)
  );
  assert.equal(resultAll.data.totalCount, 2);
  assert.equal(resultAll.data.averageScore, 6); // (8 + 4) / 2 = 6.0

  // Test pagination: when limit is 1, totalCount must report total matches (2), not the truncated page size (1)
  const resultLimited = await runWithTenant(orgId, () =>
    executeTool("query_calls", { limit: 1 }, testAuth)
  );
  assert.equal(resultLimited.data.totalCount, 2, "totalCount must reflect all matching calls across pages");
  assert.equal(resultLimited.data.calls.length, 1, "calls array must respect the limit");
  assert.equal(resultLimited.data.averageScore, 6, "averageScore must be calculated from all matches");
});

test("Member permissions are restored on token auth and enforced across tools", async () => {
  const orgId = "tenant-mcp-test";

  const memberBob: AuthUser = {
    userId: "user-bob-rep",
    role: "member",
    isAdmin: false,
    isMember: true,
    isClerkConfigured: false,
    canViewAllCalls: false,
    tenantId: orgId,
    orgId: orgId,
    clerkPlanId: null,
    billingPaid: true,
    email: "bob@other.com",
    name: "Bob Other",
  };

  // Create token with member
  const bobToken = await createApiToken("Bob Member Bot", memberBob);
  const bobAuth = await authenticateApiToken(bobToken.token);
  assert.ok(bobAuth);
  assert.equal(bobAuth.isAdmin, false, "Member token must not restore as admin");
  assert.equal(bobAuth.canViewAllCalls, false, "Member token must preserve canViewAllCalls: false");
  assert.equal(bobAuth.role, "member");

  // Bob cannot see Sam's calls in query_calls
  const bobCallQuery = await runWithTenant(orgId, () =>
    executeTool("query_calls", {}, bobAuth)
  );
  assert.equal(bobCallQuery.data.totalCount, 0, "Member without rep ownership cannot see other reps calls");

  // Bob cannot view call details of Sam's call
  await assert.rejects(
    runWithTenant(orgId, () => executeTool("get_call_details", { callId: "call-mcp-high" }, bobAuth)),
    (err: Error) => /permission/i.test(err.message)
  );

  // Bob cannot view other reps performance
  const bobRepPerf = await runWithTenant(orgId, () =>
    executeTool("get_rep_performance", {}, bobAuth)
  );
  assert.equal(bobRepPerf.data.length, 0, "Member cannot view other reps performance");

  // Bob cannot access forecast
  await assert.rejects(
    runWithTenant(orgId, () => executeTool("get_forecast", {}, bobAuth)),
    (err: any) => /admin/i.test(err.message)
  );
});

test("MCP JSON-RPC endpoint POST /api/mcp handles initialize, tools/list, and tools/call", async () => {
  const { POST: mcpPost, GET: mcpGet } = await import("../app/api/mcp/route");

  // Create a token for this test
  const tokenObj = await createApiToken("MCP Route Test Token", testAuth);

  // Test GET status & usage hints
  const getReq = new Request("http://localhost:3000/api/mcp", { method: "GET" });
  const getRes = await mcpGet(getReq);
  const getData = await getRes.json();
  assert.equal(getData.name, "sales-coach-mcp");
  assert.ok(getData.tools.length >= 5);
  assert.ok(getData.usage.streamableHttp.includes("/app/api/mcp"));
  assert.ok(getData.usage.grokCli.includes("/app/api/mcp"));

  // Test POST direct query payload
  const directQueryReq = new Request("http://localhost:3000/api/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenObj.token}`,
    },
    body: JSON.stringify({
      query: "How many calls were ranked above a 5?",
    }),
  });
  const directQueryRes = await mcpPost(directQueryReq);
  const directQueryData = await directQueryRes.json();
  assert.ok(directQueryData.answer.includes("Found 1 calls ranked at or above 5"));
  assert.equal(directQueryData.data.totalCount, 1);
  assert.equal(directQueryData.jsonrpc, "2.0");

  // Test POST initialize
  const initReq = new Request("http://localhost:3000/api/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
    }),
  });
  const initRes = await mcpPost(initReq);
  const initData = await initRes.json();
  assert.equal(initData.jsonrpc, "2.0");
  assert.equal(initData.id, 1);
  assert.equal(initData.result.serverInfo.name, "sales-coach-mcp");

  // Test POST tools/list
  const listReq = new Request("http://localhost:3000/api/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
    }),
  });
  const listRes = await mcpPost(listReq);
  const listData = await listRes.json();
  assert.ok(listData.result.tools.some((t: any) => t.name === "query_calls"));

  // Test POST tools/call with Bearer token
  const callReq = new Request("http://localhost:3000/api/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenObj.token}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "query_calls",
        arguments: { minScore: 5 },
      },
    }),
  });
  const callRes = await mcpPost(callReq);
  const callData = await callRes.json();
  assert.equal(callData.jsonrpc, "2.0");
  assert.equal(callData.id, 3);
  assert.ok(callData.result.content[0].text.includes("ranked at or above 5"));
});

test("Bot REST query endpoint POST /api/bot/query parses natural language intents", async () => {
  const { POST: botPost } = await import("../app/api/bot/query/route");

  const tokenObj = await createApiToken("Bot Query Test Token", testAuth);

  // Test natural language query: "how many calls were ranked above a 5"
  const botReq = new Request("http://localhost:3000/api/bot/query", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenObj.token}`,
    },
    body: JSON.stringify({
      query: "How many calls were ranked above a 5?",
    }),
  });

  const botRes = await botPost(botReq);
  const botData = await botRes.json();
  assert.ok(botData.answer.includes("Found 1 calls ranked at or above 5"));
  assert.equal(botData.data.totalCount, 1);
});

test("OpenAI-compatible API: GET /api/v1/models and POST /api/v1/chat/completions", async () => {
  const { GET: modelsGet } = await import("../app/api/v1/models/route");
  const { POST: chatPost } = await import("../app/api/v1/chat/completions/route");

  const tokenObj = await createApiToken("OpenAI Test Token", testAuth);

  // Test models list
  const modelsRes = await modelsGet();
  const modelsData = await modelsRes.json();
  assert.equal(modelsData.object, "list");
  assert.ok(modelsData.data.some((m: any) => m.id === "sales-coach"));

  // Test standard chat completion (non-streaming)
  const chatReq = new Request("http://localhost:3000/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenObj.token}`,
    },
    body: JSON.stringify({
      model: "sales-coach",
      messages: [
        { role: "system", content: "You are a sales coach assistant." },
        { role: "user", content: "How many calls were ranked above a 5?" },
      ],
    }),
  });

  const chatRes = await chatPost(chatReq);
  const chatData = await chatRes.json();
  assert.ok(chatData.id.startsWith("chatcmpl-"));
  assert.equal(chatData.object, "chat.completion");
  assert.equal(chatData.model, "sales-coach");
  assert.ok(chatData.choices[0].message.content.includes("ranked at or above 5"));
  assert.equal(chatData.choices[0].finish_reason, "stop");
  assert.ok(chatData.usage.total_tokens > 0);

  // Test streaming chat completion (stream: true)
  const streamReq = new Request("http://localhost:3000/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenObj.token}`,
    },
    body: JSON.stringify({
      model: "sales-coach",
      messages: [{ role: "user", content: "What is my forecast from Sales Coach?" }],
      stream: true,
    }),
  });

  const streamRes = await chatPost(streamReq);
  assert.equal(streamRes.headers.get("content-type"), "text/event-stream");
  const streamText = await streamRes.text();
  assert.ok(streamText.includes("chat.completion.chunk"));
  assert.ok(streamText.includes("data: [DONE]"));
});
