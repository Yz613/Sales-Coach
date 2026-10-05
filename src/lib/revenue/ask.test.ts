import assert from "node:assert/strict";
import { after, test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AuthUser } from "../auth";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sales-ask-"));
process.env.SALES_COACH_DB_PATH = path.join(dir, "test.db");
const providerEnv = ["GEMINI_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GROQ_API_KEY", "OPENROUTER_API_KEY", "BILLING_REQUIRED"] as const;
const savedEnv = Object.fromEntries(providerEnv.map((key) => [key, process.env[key]]));
for (const key of providerEnv) delete process.env[key];
const originalFetch = globalThis.fetch;
after(() => {
  globalThis.fetch = originalFetch;
  for (const key of providerEnv) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  fs.rmSync(dir, { recursive: true, force: true });
});

const admin: AuthUser = {
  userId: "manager", role: "admin", isAdmin: true, isMember: false, isClerkConfigured: false,
  canViewAllCalls: true, tenantId: "org-a", clerkPlanId: null, billingPaid: true, name: "Manager", email: "alex@example.com",
};
const member: AuthUser = {
  ...admin, userId: "member", role: "member", isAdmin: false, isMember: true, isClerkConfigured: true, orgId: "org-a",
  canViewAllCalls: false, clerkPlanId: "coach", email: "sam@example.com", name: "Sam",
};
const owner: AuthUser = { ...member, email: "alex@example.com", name: "Alex" };
const hostedAdmin: AuthUser = {
  ...admin, isClerkConfigured: true, orgId: "org-a", clerkPlanId: "coach", tenantId: "org-a",
};

const LINKED_QUOTE = "Our budget for this project is forty thousand dollars this quarter if the security review passes.";
const LINKED_TRANSCRIPT = [
  `Buyer: ${LINKED_QUOTE}`,
  "Rep: I will send the security packet after we confirm the economic buyer on this call.",
  "Buyer: The economic buyer is Priya and she wants a decision before December.",
].join("\n");
const SECRET = "secret competitor pricing is nine thousand";
const UNLINKED_TRANSCRIPT = `Buyer: The ${SECRET} and must stay off this deal entirely. Rep: I will not repeat that figure in the forecast or the next meeting.`;

function aiJson(answer: string, citations: { ref: string; quote: string }[]) {
  return JSON.stringify({
    choices: [{ message: { content: JSON.stringify({ answer, citations }) } }],
    usage: { prompt_tokens: 120, completion_tokens: 40 },
  });
}

test("citations stay inside real turns and packing omits calls that do not fit", async () => {
  const { citationHref, groundAskAnswer, packAskTurns, quoteGroundedInSegment, askBlocker, segmentsForAsk, buildAskPrompt } = await import("./ask");
  assert.equal(citationHref("call/1", 42.8, 55.2), "/calls/call%2F1#t-42-55");
  assert.equal(quoteGroundedInSegment(LINKED_QUOTE, "forty thousand dollars this quarter"), true);
  assert.equal(quoteGroundedInSegment(LINKED_QUOTE, "invented nine thousand"), false);
  assert.equal(askBlocker("", []), "empty");
  assert.equal(askBlocker("Rep: Hi.\nBuyer: Hello.", []), "short");
  assert.equal(askBlocker(LINKED_TRANSCRIPT, []), null);

  const segments = segmentsForAsk(LINKED_TRANSCRIPT, 180, [{ speaker: "Buyer", text: LINKED_QUOTE, start: 42, end: 55, timing: "provider" }]);
  assert.equal(segments[0].start, 42);
  const packed = packAskTurns([
    { callId: "linked", title: "Discovery", createdAt: "2026-10-02", transcriptText: LINKED_TRANSCRIPT, durationSeconds: 180, segments },
    { callId: "older", title: "Older", createdAt: "2026-09-01", transcriptText: "x".repeat(500), durationSeconds: 180, segments: [{ speaker: "Buyer", text: "x".repeat(500), start: 1, timing: "estimated" }] },
  ], 220);
  assert.deepEqual(packed.includedCallIds, ["linked"]);
  assert.deepEqual(packed.omittedCallIds, ["older"]);
  assert.equal(packed.truncated, true);
  const grounded = groundAskAnswer({
    answer: "The buyer named forty thousand dollars.",
    citations: [
      { ref: "c0s0", quote: "forty thousand dollars this quarter" },
      { ref: "c0s9", quote: LINKED_QUOTE },
      { ref: "c0s0", quote: "not in the transcript at all" },
    ],
  }, packed.turns);
  assert.equal(grounded.citations.length, 1);
  assert.equal(grounded.citations[0].start, 42);
  assert.equal(grounded.citations[0].href, "/calls/linked#t-42-55");
  assert.match(grounded.citations[0].quote, /forty thousand dollars/);
  const missed = groundAskAnswer({ answer: "They agreed to nine thousand.", citations: [{ ref: "c0s0", quote: SECRET }] }, packed.turns);
  assert.equal(missed.citations.length, 0);
  assert.match(missed.answer, /Nothing in the included transcript/);
  assert.doesNotMatch(buildAskPrompt("What budget was named?", packed), new RegExp(SECRET));
});

test("call and deal questions cite linked transcripts and enforce access, length, and allowance", async () => {
  process.env.BILLING_REQUIRED = "true";
  const { db, ensureRevenueSchema } = await import("../db");
  const schema = await import("../db/schema");
  const { runWithTenant } = await import("../tenant");
  const { setSetting, getSetting } = await import("../db/service");
  const { utcMonthKey } = await import("../billing");
  const { answerCallQuestion, answerDealQuestion } = await import("./ask");
  await ensureRevenueSchema();

  await db.insert(schema.reps).values({ id: "rep", orgId: "org-a", name: "Alex", email: "alex@example.com", role: "AE", createdAt: "2026-10-01" }).run();
  const calls = [
    { id: "reviewed", transcriptText: LINKED_TRANSCRIPT, segments: [{ speaker: "Buyer", text: LINKED_QUOTE, start: 42, end: 55, timing: "provider" }, { speaker: "Rep", text: "I will send the security packet after we confirm the economic buyer on this call.", start: 56, timing: "provider" }, { speaker: "Buyer", text: "The economic buyer is Priya and she wants a decision before December.", start: 70, timing: "provider" }], crm: ["deal-a"], reviewed: true },
    { id: "unlinked", transcriptText: UNLINKED_TRANSCRIPT, segments: [{ speaker: "Buyer", text: UNLINKED_TRANSCRIPT, start: 10, timing: "provider" }], crm: ["deal-b"], reviewed: false },
    { id: "empty", transcriptText: "", segments: [], crm: ["deal-a"], reviewed: false },
    { id: "short", transcriptText: "Rep: Hi.\nBuyer: Hello.", segments: [{ speaker: "Rep", text: "Hi.", start: 1, timing: "estimated" }], crm: ["deal-a"], reviewed: false },
  ] as const;
  for (const call of calls) {
    await db.insert(schema.calls).values({
      id: call.id, orgId: "org-a", repId: "rep", prospectCompany: "Acme", prospectName: "Pat", callStage: "Discovery",
      coreOutcome: "Meeting booked", durationSeconds: 180, transcriptText: call.transcriptText, createdAt: call.id === "unlinked" ? "2026-09-01T00:00:00Z" : "2026-10-02T00:00:00Z",
    }).run();
    await db.insert(schema.callMetadata).values({
      callId: call.id, orgId: "org-a", title: call.id === "reviewed" ? "Discovery review" : call.id,
      segments: JSON.stringify(call.segments), crmRecordIds: JSON.stringify(call.crm),
      reviewedAt: call.reviewed ? "2026-10-03T00:00:00Z" : null, reviewedBy: call.reviewed ? "Manager" : null, createdAt: "2026-10-02",
    }).run();
  }
  await db.insert(schema.crmRecords).values({
    id: "deal-a", orgId: "org-a", connectionId: "crm", provider: "hubspot", externalId: "deal-a", kind: "deal",
    name: "Acme expansion", amount: "40000", currency: "USD", owner: "Alex", closeDate: "2026-12-15", stage: "Qualified", syncedAt: "2026-10-02",
  }).run();
  await db.insert(schema.crmRecords).values({
    id: "deal-b", orgId: "org-a", connectionId: "crm", provider: "hubspot", externalId: "deal-b", kind: "deal",
    name: "Other deal", amount: "9000", currency: "USD", stage: "Qualified", syncedAt: "2026-10-02",
  }).run();

  let prompts: string[] = [];
  globalThis.fetch = (async (_input: unknown, init?: { body?: string }) => {
    const body = JSON.parse(init?.body || "{}");
    const prompt = body.messages?.[1]?.content || "";
    prompts.push(prompt);
    const quote = prompt.includes(LINKED_QUOTE) ? "forty thousand dollars this quarter" : "not present";
    return new Response(aiJson("The buyer named a budget of forty thousand dollars this quarter.", [{ ref: "c0s0", quote }]), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;

  await runWithTenant("org-a", async () => {
    await setSetting("ai_provider", "openai");
    await setSetting("active_model", "gpt-4o-mini");
    await setSetting("ai_api_key", "sk-test-ask-key");
    await setSetting("billing:overage_opt_in", "false");
    const month = utcMonthKey();
    await setSetting(`billing:usage:${month}`, JSON.stringify({ month, creditsUsed: 0, overageCredits: 0, overageAmountUsd: 0 }));

    await assert.rejects(answerCallQuestion(member, "reviewed", "What budget did the buyer name?"), (error: { status?: number }) => error.status === 404);
    assert.equal(prompts.length, 0, "A hidden call must not reach the provider");
    await assert.rejects(answerCallQuestion(admin, "missing", "What budget did the buyer name?"), (error: { status?: number }) => error.status === 404);
    await assert.rejects(answerCallQuestion(admin, "empty", "What happened?"), (error: { status?: number; message?: string }) => error.status === 422 && /no transcript/.test(error.message || ""));
    await assert.rejects(answerCallQuestion(admin, "short", "What happened?"), (error: { status?: number; message?: string }) => error.status === 422 && /too short/.test(error.message || ""));
    assert.equal(prompts.length, 0);

    const own = await answerCallQuestion(owner, "reviewed", "What budget did the buyer name?");
    assert.match(own.answer, /forty thousand/);
    assert.equal(own.citations.length, 1);
    assert.equal(own.citations[0].start, 42);
    assert.equal(own.citations[0].href, "/calls/reviewed#t-42-55");
    assert.match(own.citations[0].quote, /forty thousand dollars/);
    assert.equal(own.creditsCharged, 1);
    assert.doesNotMatch(prompts.at(-1) || "", new RegExp(SECRET));

    await assert.rejects(answerDealQuestion({ ...admin, isAdmin: false }, "deal-a", "What budget did the buyer name?"), (error: { status?: number }) => error.status === 403);
    const beforeDeal = prompts.length;
    const deal = await answerDealQuestion(admin, "deal-a", "What budget did the buyer name?");
    assert.equal(prompts.length, beforeDeal + 1);
    assert.deepEqual(deal.includedCallIds, ["reviewed"]);
    assert.equal(deal.citations[0].callId, "reviewed");
    assert.equal(deal.citations[0].href, "/calls/reviewed#t-42-55");
    assert.match(deal.citations[0].quote, /forty thousand dollars/);
    assert.doesNotMatch(prompts.at(-1) || "", new RegExp(SECRET));
    assert.doesNotMatch(prompts.at(-1) || "", /nine thousand/);

    const usage = JSON.parse((await getSetting(`billing:usage:${month}`)) || "{}");
    assert.equal(usage.creditsUsed, 2);

    await setSetting(`billing:usage:${month}`, JSON.stringify({ month, creditsUsed: 250, overageCredits: 0, overageAmountUsd: 0 }));
    const callsBeforeQuota = prompts.length;
    await assert.rejects(answerCallQuestion(hostedAdmin, "reviewed", "What budget did the buyer name?"), (error: { status?: number }) => error.status === 402);
    assert.equal(prompts.length, callsBeforeQuota, "A blocked allowance must not call the provider");

    await setSetting("ai_api_key", "");
    await assert.rejects(answerCallQuestion(admin, "reviewed", "What budget did the buyer name?"), (error: { status?: number; message?: string }) => error.status === 422 && /provider key/.test(error.message || ""));
  });

  prompts = [];
  await runWithTenant("org-b", async () => {
    await assert.rejects(answerCallQuestion(admin, "reviewed", "What budget did the buyer name?"), (error: { status?: number }) => error.status === 404);
    await assert.rejects(answerDealQuestion(admin, "deal-a", "What budget did the buyer name?"), (error: { status?: number }) => error.status === 404);
    assert.equal(prompts.length, 0);
  });
});
