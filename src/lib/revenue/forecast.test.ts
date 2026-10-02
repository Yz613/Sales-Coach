import assert from "node:assert/strict";
import { after, test } from "node:test";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildForecast, defaultReview, emptyPlaybook, periodBounds, validDate, type DealSummary } from "./forecast-model";
import type { AuthUser } from "../auth";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sales-forecast-"));
process.env.SALES_COACH_DB_PATH = path.join(dir, "test.db");
after(() => fs.rmSync(dir, { recursive: true, force: true }));
const auth: AuthUser = { userId: "manager", role: "admin", isAdmin: true, isMember: false, isClerkConfigured: false, canViewAllCalls: true, tenantId: "org-a", clerkPlanId: null, billingPaid: true, name: "Manager" };
function deal(id: string, overrides: Partial<DealSummary> = {}): DealSummary {
  return { id, name: id, stage: "Negotiation", pipeline: "Sales", owner: "Alex", amount: "100", currency: "USD", closeDate: "2026-12-31", closed: false, won: false,
    syncedAt: "2026-10-02", risks: [], review: defaultReview(), linkedCalls: [], associated: [], openActions: 0, ...overrides };
}

test("calendar periods handle year rollover, leap days, invalid dates, and exact exclusive boundaries", () => {
  assert.deepEqual(periodBounds("2026-Q4"), { from: "2026-10-01", to: "2027-01-01" });
  assert.deepEqual(periodBounds("2024-02"), { from: "2024-02-01", to: "2024-03-01" });
  for (const period of ["2026-Q0", "2026-Q5", "2026-13", "2026-1", "1999-Q1", "2101-Q1", "2026-Q4junk"]) assert.throws(() => periodBounds(period));
  assert.equal(validDate("2026-02-30"), false); assert.equal(validDate("2024-02-29"), true);
  const snapshot = buildForecast([deal("first", { closeDate: "2026-10-01T23:00:00Z" }), deal("last"), deal("after", { closeDate: "2027-01-01" }), deal("before", { closeDate: "2026-09-30" }), deal("invalid", { closeDate: "2026-11-31" })], { period: "2026-Q4", owner: "", currency: "" });
  assert.deepEqual(snapshot.deals.map(d => d.id), ["first", "last"]); assert.equal(snapshot.undatedDeals, 1);
});

test("forecast separates currencies, excludes lost and omitted from projections, and makes missing data visible", () => {
  const deals = [deal("commit", { review: { ...defaultReview(), category: "commit", probability: 80 } }), deal("best", { amount: "200", review: { ...defaultReview(), category: "best_case", probability: 50 } }),
    deal("pipeline", { amount: "300" }), deal("omitted", { amount: "500", review: { ...defaultReview(), category: "omitted", probability: 100 } }),
    deal("won", { amount: "50", closed: true, won: true }), deal("lost", { amount: "9000", closed: true }), deal("eur", { currency: "eur", amount: "20", review: { ...defaultReview(), probability: 25 } }),
    deal("unknown", { currency: null, amount: "" }), deal("undated", { closeDate: null }), deal("negative", { amount: "-10" }), deal("zero", { amount: "0", review: { ...defaultReview(), probability: 0 } })];
  const snapshot = buildForecast(deals, { period: "2026-Q4", owner: "", currency: "" });
  const usd = snapshot.totals.find(t => t.currency === "USD")!;
  assert.equal(usd.won, 50); assert.equal(usd.open, 600); assert.equal(usd.committed, 150); assert.equal(usd.upside, 350); assert.equal(usd.weighted, 230); assert.equal(usd.omitted, 500);
  assert.equal(usd.missingAmounts, 1); assert.equal(usd.missingProbabilities, 2); assert.equal(snapshot.undatedDeals, 1);
  assert.equal(snapshot.totals.find(t => t.currency === "EUR")!.weighted, 5);
  assert.equal(snapshot.deals.find(d => d.id === "negative")!.amount, null);
  assert.equal(snapshot.deals.find(d => d.id === "zero")!.amount, "0");
  assert.equal(snapshot.totals.find(t => t.currency === "Unspecified currency")!.missingAmounts, 1);
  assert.equal(buildForecast(deals, { period: "2026-Q4", owner: "Nobody", currency: "" }).deals.length, 0);
  assert.deepEqual(buildForecast(deals, { period: "2026-Q4", owner: "Alex", currency: "EUR" }).deals.map(d => d.id), ["eur"]);
  assert.ok(!JSON.stringify(snapshot).includes("playbook"), "Historical snapshots must not copy transcript evidence");
});

test("deal reviews validate evidence, protect concurrent edits, and preserve forecast history across CRM updates and tenant boundaries", async () => {
  const { db, ensureRevenueSchema } = await import("../db"); const schema = await import("../db/schema");
  const { runWithTenant } = await import("../tenant"); const { and, eq } = await import("drizzle-orm");
  const { dealDetail, dealEvidence, saveDealReview, forecastWorkspace, submitForecast, forecastFilters } = await import("./forecast");
  const { deleteConversation } = await import("./privacy");
  await ensureRevenueSchema();
  await db.insert(schema.reps).values({ id: "rep", orgId: "org-a", name: "Alex", email: "alex@example.com", role: "AE", createdAt: "2026-10-01" }).run();
  await db.insert(schema.calls).values({ id: "call", orgId: "org-a", repId: "rep", prospectCompany: "Acme", prospectName: "Pat", callStage: "Discovery", coreOutcome: "Meeting booked", durationSeconds: 60, transcriptText: "Buyer: Our target is saving 20 hours per month.", createdAt: "2026-10-01T12:00:00Z" }).run();
  const quote = "Our target is saving 20 hours per month.";
  await db.insert(schema.callMetadata).values({ callId: "call", orgId: "org-a", title: "Discovery", crmRecordIds: JSON.stringify(["deal-a"]), segments: JSON.stringify([{ speaker: "Buyer", text: quote, start: 15, timing: "provider" }]), participants: JSON.stringify([{ name: "Pat", email: "pat@acme.com", external: true }, { name: "Pat", email: "pat@acme.com", external: true }, { name: "Alex", email: "alex@example.com", external: false }]), actionItems: JSON.stringify([{ id: "send", description: "Send proposal", completed: false }]), createdAt: "2026-10-01" }).run();
  for (const [id, orgId] of [["deal-a", "org-a"], ["deal-b", "org-b"]]) await db.insert(schema.crmRecords).values({ id, orgId, connectionId: "crm", provider: "hubspot", externalId: id, kind: "deal", name: "Acme", amount: "10000", currency: "USD", owner: "Alex", closeDate: "2026-12-15", stage: "Qualified", syncedAt: "2026-10-01" }).run();
  await runWithTenant("org-a", async () => {
    const initial = await dealDetail(auth, "deal-a"); assert.equal(initial.deal.review.revision, 0); assert.equal(initial.stakeholders.length, 1); assert.equal(initial.stakeholders[0].conversations, 1); assert.equal(initial.actions.length, 1);
    assert.equal((await dealEvidence(auth, "deal-a", "call"))[0].text, quote);
    const playbook = emptyPlaybook(); playbook.metrics = { status: "confirmed", note: "", evidence: { callId: "call", start: 15, quote } };
    const body = { category: "commit", probability: 80, nextStep: "Confirm purchase approval", nextStepDate: "2026-12-10", playbook, revision: 0 };
    await assert.rejects(saveDealReview({ ...auth, isAdmin: false }, "deal-a", body), (e: any) => e.status === 403);
    await assert.rejects(dealEvidence(auth, "deal-a", "unlinked"), (e: any) => e.status === 404);
    await assert.rejects(saveDealReview(auth, "deal-a", { ...body, probability: 101 }), /probability/);
    await assert.rejects(saveDealReview(auth, "deal-a", { ...body, nextStepDate: "2026-02-30" }), /valid date/);
    await assert.rejects(saveDealReview(auth, "deal-a", { ...body, playbook: { ...playbook, metrics: { ...playbook.metrics, evidence: { callId: "call", start: 15, quote: "Invented quote" } } } }), /changed/);
    await assert.rejects(saveDealReview(auth, "deal-a", { ...body, playbook: { ...playbook, metrics: { status: "confirmed", note: "", evidence: null } } }), /note or transcript/);
    const writes = await Promise.allSettled([saveDealReview(auth, "deal-a", body), saveDealReview(auth, "deal-a", body)]);
    assert.equal(writes.filter(w => w.status === "fulfilled").length, 1); assert.equal((writes.find(w => w.status === "rejected") as PromiseRejectedResult).reason.status, 409);
    let detail = await dealDetail(auth, "deal-a"); assert.equal(detail.deal.review.revision, 1); assert.equal(detail.deal.review.playbook.metrics.evidence?.quote, quote);
    const rawReview = await db.select().from(schema.dealReviews).get(); assert.ok(!rawReview.playbook.includes(quote), "Store evidence fingerprints, never transcript copies");
    await assert.rejects(saveDealReview(auth, "deal-a", body), (e: any) => e.status === 409);
    const updates = await Promise.allSettled([saveDealReview(auth, "deal-a", { ...body, revision: 1, probability: 60 }), saveDealReview(auth, "deal-a", { ...body, revision: 1, probability: 60 })]);
    assert.equal(updates.filter(w => w.status === "fulfilled").length, 1);
    const filters = { period: "2026-Q4", owner: "Alex", currency: "USD" };
    assert.equal((await forecastWorkspace(auth, filters)).snapshot.totals[0].weighted, 6000);
    const submissionBody = { ...filters, requestId: randomUUID(), target: 20000, notes: "Security sign-off remains" };
    const saved = await submitForecast(auth, submissionBody); assert.equal(saved.snapshot.totals[0].committed, 10000); assert.equal(saved.target, "20000");
    assert.ok(!JSON.stringify(saved.snapshot).includes(quote));
    await db.update(schema.crmRecords).set({ amount: "15000" }).where(eq(schema.crmRecords.id, "deal-a")).run();
    const live = await forecastWorkspace(auth, filters); assert.equal(live.snapshot.totals[0].committed, 15000); assert.equal(live.history[0].snapshot.totals[0].committed, 10000);
    assert.equal((await submitForecast(auth, submissionBody)).snapshot.totals[0].committed, 10000, "Retries must not regenerate snapshots");
    await assert.rejects(submitForecast(auth, { ...submissionBody, notes: "Changed" }), (e: any) => e.status === 409);
    assert.equal((await forecastWorkspace(auth, { ...filters, owner: "" })).history.length, 0);
    await assert.rejects(submitForecast(auth, { ...submissionBody, requestId: randomUUID(), currency: "" }), /known single currency/);
    await assert.rejects(forecastWorkspace({ ...auth, isAdmin: false }, filters), (e: any) => e.status === 403);
    assert.throws(() => forecastFilters({ period: "2026-00" })); assert.throws(() => forecastFilters({ owner: {} }));
    await runWithTenant("org-b", async () => {
      await assert.rejects(dealDetail(auth, "deal-a"), (e: any) => e.status === 404);
      await assert.rejects(saveDealReview(auth, "deal-a", { ...body, revision: 2 }), (e: any) => e.status === 404);
      assert.equal((await forecastWorkspace(auth, filters)).history.length, 0);
      assert.equal((await dealDetail(auth, "deal-b")).deal.review.revision, 0);
    });
    await db.update(schema.callMetadata).set({ crmRecordIds: "[]" }).where(eq(schema.callMetadata.callId, "call")).run();
    detail = await dealDetail(auth, "deal-a"); assert.equal(detail.deal.review.playbook.metrics.evidence, null); assert.equal(detail.deal.review.playbook.metrics.status, "unknown");
    await db.update(schema.callMetadata).set({ crmRecordIds: '["deal-a"]', segments: JSON.stringify([{ speaker: "Buyer", text: "Changed transcript", start: 15 }]) }).where(eq(schema.callMetadata.callId, "call")).run();
    assert.equal((await dealDetail(auth, "deal-a")).deal.review.playbook.metrics.evidence, null);
    await deleteConversation("call", "manager");
    assert.equal((await dealDetail(auth, "deal-a")).deal.review.playbook.metrics.evidence, null);
    assert.equal((await forecastWorkspace(auth, filters)).history[0].snapshot.totals[0].committed, 10000);
    assert.equal((await db.select().from(schema.forecastSubmissions).where(and(eq(schema.forecastSubmissions.orgId, "org-a"), eq(schema.forecastSubmissions.period, "2026-Q4"))).all()).length, 1);
    const concurrentBody = { ...submissionBody, requestId: randomUUID() };
    const concurrent = await Promise.all([submitForecast(auth, concurrentBody), submitForecast(auth, concurrentBody)]);
    assert.equal(concurrent[0].id, concurrent[1].id);
    assert.equal((await forecastWorkspace(auth, filters)).history.length, 2);
    const racingId = randomUUID();
    const differentRequests = await Promise.allSettled([submitForecast(auth, { ...concurrentBody, requestId: racingId, notes: "First" }), submitForecast(auth, { ...concurrentBody, requestId: racingId, notes: "Second" })]);
    assert.equal(differentRequests.filter(r => r.status === "fulfilled").length, 1);
    assert.equal((differentRequests.find(r => r.status === "rejected") as PromiseRejectedResult).reason.status, 409);
    await db.delete(schema.crmRecords).where(eq(schema.crmRecords.id, "deal-a")).run();
    const archived = await forecastWorkspace(auth, filters);
    assert.equal(archived.snapshot.deals.length, 0); assert.equal(archived.history.length, 3);
    assert.deepEqual(archived.owners, ["Alex"]); assert.deepEqual(archived.currencies, ["USD"]);
    const minimal = await submitForecast(auth, { period: "2026-Q4", requestId: randomUUID() });
    assert.equal(minimal.target, null); assert.equal(minimal.notes, "");
  });
});
