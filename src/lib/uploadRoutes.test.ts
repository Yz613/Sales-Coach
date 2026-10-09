import assert from "node:assert/strict";
import { after, test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { POST as batchUpload } from "../app/api/calls/batch-upload/route";
import { POST as singleUpload } from "../app/api/calls/upload/route";
import { POST as reanalyze } from "../app/api/calls/[id]/evaluate/route";
import { db } from "./db";
import { calls, evaluations, reps } from "./db/schema";
import { getOrCreateRep, getSetting, setSetting, updateCallStatus } from "./db/service";
import { runWithAuth, type AuthUser } from "./auth";
import { runWithTenant } from "./tenant";
import { utcMonthKey } from "./billing";
import { batchTranscriptsFromCsv, parseCsvRecords } from "./batchUpload";

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "sales-upload-regression-"));
process.env.SALES_COACH_DB_PATH = path.join(directory, "test.db");
process.env.CALL_AUDIO_DIR = path.join(directory, "audio");
process.env.INTEGRATION_KEY_FILE = path.join(directory, "integration.key");
process.env.BILLING_REQUIRED = "true";
process.env.CLEF_EVALUATION_MODE = "off";
for (const name of ["CLERK_SECRET_KEY", "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "GEMINI_API_KEY", "OPENAI_API_KEY", "GROQ_API_KEY", "ANTHROPIC_API_KEY", "DEEPSEEK_API_KEY", "OPENROUTER_API_KEY", "BILLING_EXEMPT_ORG_IDS"]) delete process.env[name];
// Auth is supplied by runWithAuth; these fixture values exercise the hosted page gate.
process.env.CLERK_SECRET_KEY = "sk_test_upload_fixture";
process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_upload_fixture";
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => { throw new Error("Upload regressions must not call live services."); };
after(() => {
  globalThis.fetch = originalFetch;
  db.$client.close();
  fs.rmSync(directory, { recursive: true, force: true });
});

const transcript = Array.from({ length: 12 }, (_, index) =>
  `[${String(index).padStart(2, "0")}:00] ${index % 2 ? "Prospect" : "Rep"}: ${index % 2 ? 'Our manual approvals delay shipments. We need a solution with a budget of $20,000.' : 'What challenges affect your team, and who decides how to fix them?'}`
).join("\n");
const csv = (count = 1, text = transcript) => 'company,contact,stage,transcript\r\n' + Array.from({ length: count }, () =>
  `"Example, Inc.","Alex ""Pat"" Smith",First Discovery,"${text.replaceAll('"', '""')}"`
).join("\r\n");
const request = (body: unknown) => new Request("http://localhost/app/api/calls/batch-upload", {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
});
const multipart = (...contents: string[]) => {
  const form = new FormData();
  form.set("defaultRepName", "CSV Rep");
  form.set("defaultStage", "Cold Call");
  contents.forEach((content, index) => form.append("files", new File([content], `calls-${index}.csv`, { type: "text/csv" })));
  return new Request("http://localhost/app/api/calls/batch-upload", { method: "POST", body: form });
};
function authFor(orgId: string): AuthUser {
  return { userId: "user_upload", orgId, tenantId: orgId, role: "admin", isAdmin: true, isMember: false,
    isClerkConfigured: true, canViewAllCalls: true, clerkPlanId: "coach", billingPaid: true,
    email: "rep@example.com", name: "CSV Rep" };
}
async function inWorkspace(orgId: string, fn: (auth: AuthUser) => Promise<void>) {
  const auth = authFor(orgId);
  await runWithAuth(auth, () => runWithTenant(orgId, () => fn(auth)));
}

test("CSV keeps complete multiline dialogue, escaped quotes, commas, and metadata", () => {
  const [item] = batchTranscriptsFromCsv("\uFEFF" + csv(), "calls.csv", "Cold Call");
  assert.equal(item.transcriptText, transcript);
  assert.equal(item.prospectCompany, "Example, Inc.");
  assert.equal(item.prospectName, 'Alex "Pat" Smith');
  assert.equal(item.callStage, "First Discovery");
  assert.equal(item.durationSeconds, 660);
  assert.deepEqual(parseCsvRecords('a,b\r\n\r\n"line one\nline two","say ""hi"""\r\n'), [["a", "b"], ["line one\nline two", 'say "hi"']]);
  assert.throws(() => parseCsvRecords('transcript\n"unfinished'), /unclosed quoted field/);
});

test("CSV upload stores every turn and charges one call, regardless of line count", async () => {
  await inWorkspace("org_upload_csv", async (auth) => {
    await setSetting("billing:eval_limit", "1");
    await setSetting("billing:overage_opt_in", "false");
    const response = await batchUpload(multipart(csv()));
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.processedCount, 1);
    assert.equal(result.failedCount, 0);
    const call = await db.select().from(calls).where(eq(calls.id, result.results[0].callId)).get();
    assert.equal(call.transcriptText, transcript);
    assert.equal(call.status, "completed");
    assert.equal(call.orgId, auth.orgId);
    assert.equal(call.durationSeconds, 660);
    assert.equal(JSON.parse((await getSetting(`billing:usage:${utcMonthKey()}`))!).creditsUsed, 1);
  });
});

test("batch size is checked across all CSV files before creating reps or calls", async () => {
  await inWorkspace("org_upload_limit", async () => {
    const response = await batchUpload(multipart(csv(6), csv(5)));
    assert.equal(response.status, 413);
    assert.deepEqual(await db.select().from(calls).where(eq(calls.orgId, "org_upload_limit")).all(), []);
    assert.deepEqual(await db.select().from(reps).where(eq(reps.orgId, "org_upload_limit")).all(), []);
    assert.equal((await batchUpload(multipart(csv(11)))).status, 413);
  });
});

test("empty, malformed, and wrong-type batch requests fail without creating calls", async () => {
  await inWorkspace("org_upload_invalid", async () => {
    for (const body of [null, {}, { calls: {} }, { calls: [null] }, { calls: [{ transcriptText: {} }] }, { calls: [{ transcriptText: transcript, durationSeconds: -1 }] }]) {
      assert.equal((await batchUpload(request(body))).status, 400, JSON.stringify(body));
    }
    assert.equal((await batchUpload(request({ calls: [] }))).status, 400);
    assert.equal((await batchUpload(multipart("company,transcript\n"))).status, 400);
    assert.equal((await batchUpload(multipart('transcript\n"unclosed'))).status, 422);
    const form = new FormData(); form.set("files", "not a file");
    assert.equal((await batchUpload(new Request("http://localhost/app/api/calls/batch-upload", { method: "POST", body: form }))).status, 400);
    assert.deepEqual(await db.select().from(calls).where(eq(calls.orgId, "org_upload_invalid")).all(), []);
  });
});

test("quota preflight counts full transcript duration and rejects a batch without partial calls", async () => {
  await inWorkspace("org_upload_quota", async () => {
    await setSetting("billing:eval_limit", "1"); await setSetting("billing:overage_opt_in", "false");
    assert.equal((await batchUpload(multipart(csv(1, transcript + '\n[75:00] Prospect: Thank you for the discussion.')))).status, 402);
    assert.equal((await batchUpload(request({ calls: [{ transcriptText: transcript }, { transcriptText: transcript }] }))).status, 402);
    assert.deepEqual(await db.select().from(calls).where(eq(calls.orgId, "org_upload_quota")).all(), []);
  });
});

test("JSON upload resolves reps within the current workspace and defaults the stage", async () => {
  let foreignId = "";
  await inWorkspace("org_upload_foreign", async () => { foreignId = await getOrCreateRep(undefined, "Foreign Rep"); });
  await inWorkspace("org_upload_json", async (auth) => {
    const response = await batchUpload(request({ calls: [{ repId: foreignId, transcriptText: transcript }] }));
    assert.equal(response.status, 200);
    const result = await response.json(); assert.equal(result.processedCount, 1);
    const call = await db.select().from(calls).where(eq(calls.id, result.results[0].callId)).get();
    assert.notEqual(call.repId, foreignId);
    const rep = await db.select().from(reps).where(eq(reps.id, call.repId)).get();
    assert.equal(rep.orgId, auth.orgId); assert.equal(call.callStage, "Cold Call");
  });
});

test("member batch uploads always attach calls to the verified member rep", async () => {
  await inWorkspace("org_upload_member", async (admin) => {
    const otherId = await getOrCreateRep(undefined, "Other Rep", "AE", "other@example.com");
    const member = { ...admin, role: "member" as const, isAdmin: false, isMember: true, canViewAllCalls: false };
    const response = await runWithAuth(member, () => batchUpload(request({ calls: [{ repId: otherId, transcriptText: transcript }] })));
    assert.equal(response.status, 200);
    const result = await response.json(); assert.equal(result.processedCount, 1);
    const call = await db.select().from(calls).where(eq(calls.id, result.results[0].callId)).get();
    const rep = await db.select().from(reps).where(eq(reps.id, call.repId)).get();
    assert.equal(rep.email, member.email); assert.notEqual(call.repId, otherId);
  });
});

test("single evaluation failure marks a saved call failed and allows a later retry", async () => {
  await inWorkspace("org_upload_failure", async () => {
    const repId = await getOrCreateRep(undefined, "Failure Rep");
    db.$client.exec("CREATE TRIGGER upload_failure BEFORE INSERT ON evaluations WHEN NEW.org_id = 'org_upload_failure' BEGIN SELECT RAISE(ABORT, 'simulated evaluation write failure'); END");
    try {
      const response = await singleUpload(request({ repId, transcriptText: transcript }));
      assert.equal(response.status, 500);
      const [call] = await db.select().from(calls).where(eq(calls.orgId, "org_upload_failure")).all();
      assert.equal(call.status, "failed"); assert.equal(call.coreOutcome, "Evaluation failed");
      assert.deepEqual(await db.select().from(evaluations).where(eq(evaluations.callId, call.id)).all(), []);
      assert.equal(await getSetting(`billing:usage:${utcMonthKey()}`), null);
    } finally { db.$client.exec("DROP TRIGGER upload_failure"); }
    assert.equal((await singleUpload(request({ repId, transcriptText: transcript }))).status, 200);
  });
});

test("batch evaluation failures do not prevent remaining calls from completing", async () => {
  await inWorkspace("org_upload_partial", async () => {
    const repId = await getOrCreateRep(undefined, "Partial Rep");
    db.$client.exec("CREATE TRIGGER batch_failure BEFORE INSERT ON evaluations WHEN NEW.call_id IN (SELECT id FROM calls WHERE prospect_company = 'Fail this fixture') BEGIN SELECT RAISE(ABORT, 'simulated evaluation write failure'); END");
    try {
      const response = await batchUpload(request({ calls: [{ repId, prospectCompany: "Fail this fixture", transcriptText: transcript }, { repId, transcriptText: transcript }] }));
      assert.equal(response.status, 200); const result = await response.json();
      assert.equal(result.processedCount, 1); assert.equal(result.failedCount, 1);
      const failed = await db.select().from(calls).where(eq(calls.id, result.results[0].callId)).get();
      const completed = await db.select().from(calls).where(eq(calls.id, result.results[1].callId)).get();
      assert.equal(failed.status, "failed"); assert.equal(completed.status, "completed");
    } finally { db.$client.exec("DROP TRIGGER batch_failure"); }
  });
});

test("late failure cleanup never overwrites a completed evaluation", async () => {
  await inWorkspace("org_upload_json", async () => {
    const [call] = await db.select().from(calls).where(eq(calls.orgId, "org_upload_json")).all();
    await updateCallStatus(call.id, "failed", "Evaluation failed", "analyzing");
    const saved = await db.select().from(calls).where(eq(calls.id, call.id)).get();
    assert.equal(saved.status, "completed");
  });
});

test("failed reanalysis preserves the previous review and successful retry replaces it once", async () => {
  await inWorkspace("org_upload_reanalysis", async () => {
    const repId = await getOrCreateRep(undefined, "Reanalysis Rep");
    const uploaded = await singleUpload(request({ repId, transcriptText: transcript }));
    assert.equal(uploaded.status, 200);
    const { callId } = await uploaded.json();
    const [original] = await db.select().from(evaluations).where(eq(evaluations.callId, callId)).all();
    const req = () => new Request(`http://localhost/app/api/calls/${callId}/evaluate`, { method: "POST" });
    const context = { params: Promise.resolve({ id: callId }) };
    db.$client.exec("CREATE TRIGGER reanalysis_failure BEFORE INSERT ON evaluations WHEN NEW.org_id = 'org_upload_reanalysis' BEGIN SELECT RAISE(ABORT, 'simulated replacement failure'); END");
    try {
      assert.equal((await reanalyze(req(), context)).status, 500);
      assert.deepEqual(await db.select().from(evaluations).where(eq(evaluations.callId, callId)).all(), [original]);
    } finally { db.$client.exec("DROP TRIGGER reanalysis_failure"); }
    assert.equal((await reanalyze(req(), context)).status, 200);
    const saved = await db.select().from(evaluations).where(eq(evaluations.callId, callId)).all();
    assert.equal(saved.length, 1); assert.notEqual(saved[0].id, original.id);
  });
});


test("fallback reviews never invent prospect objections or rep quotes", async () => {
  await inWorkspace("org_upload_evidence", async () => {
    const repId = await getOrCreateRep(undefined, "Evidence Rep");
    for (const text of [transcript, "Rep: What challenges slow down your deliveries?\nProspect: Email approvals take several hours every day.\nRep: What budget have you allocated?"]) {
      const response = await singleUpload(request({ repId, transcriptText: text }));
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.deepEqual(body.evaluation.missedOpportunities, []);
      assert.doesNotMatch(body.evaluation.bottomLine, /treated soft pushback|Q3|August/);
    }
    const text = "Rep: Hello Alex, what challenges do you face?\nProspect: Just send me an email with more information.\nRep: Absolutely, I'll send that over today.";
    const response = await singleUpload(request({ repId, transcriptText: text }));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.evaluation.missedOpportunities.length, 1);
    for (const moment of body.evaluation.missedOpportunities) {
      assert.ok(text.includes(moment.prospectOpening));
      assert.ok(text.includes(moment.repSurrender));
    }
  });
});
