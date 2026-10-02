import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { build } from "esbuild";
import { Miniflare, Response as WorkerResponse, convertV4MiniflareOptions } from "miniflare";

// Use workerd's native fetch/Request/crypto, so Node-only mocks cannot hide hosting failures.
const workerSource = `
import { boundedRequest } from './src/lib/security-policy';
import { providerRequest } from './src/lib/integrations/http';
import { createCrmNote, sendAutomationEvent } from './src/lib/integrations/outbound';
import { encryptCredentials, decryptCredentials } from './src/lib/revenue/security';
import { pingProvider } from './src/lib/ai/llm';
import { transcribeAudio } from './src/lib/ai/transcribe';
import { REVENUE_MIGRATIONS } from './src/lib/db/revenueMigrations';
import { externalTasks, taskExports, integrationExports, callProviderInsights, dealReviews, forecastSubmissions } from './src/lib/db/schema';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and } from 'drizzle-orm';
export default { async fetch(request, env) {
  const url = new URL(request.url);
  try {
    if (url.pathname === '/forecast-storage') {
      await env.DB.prepare('CREATE TABLE IF NOT EXISTS calls (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, created_at TEXT NOT NULL)').run();
      await env.DB.batch(REVENUE_MIGRATIONS.map(statement => env.DB.prepare(statement)));
      const database = drizzle(env.DB); const now = new Date().toISOString();
      const review = { id:'review-d1', orgId:'org_a', dealId:'deal', category:'commit', probability:80, revision:1, updatedBy:'manager', updatedAt:now };
      const inserts = await Promise.all(Array.from({ length:24 }, () => database.insert(dealReviews).values(review).onConflictDoNothing().returning({ id:dealReviews.id }).all()));
      const updates = await Promise.all(Array.from({ length:24 }, () => database.update(dealReviews).set({ revision:2, probability:60 }).where(and(eq(dealReviews.id,'review-d1'),eq(dealReviews.orgId,'org_a'),eq(dealReviews.revision,1))).returning({ id:dealReviews.id }).all()));
      const foreign = await database.update(dealReviews).set({ probability:0 }).where(and(eq(dealReviews.id,'review-d1'),eq(dealReviews.orgId,'org_b'))).returning().all();
      await database.insert(forecastSubmissions).values({ id:'forecast-d1', orgId:'org_a', period:'2026-Q4', currency:'USD', target:'20000', snapshot:JSON.stringify({ committed:10000 }), createdBy:'manager', createdAt:now }).onConflictDoNothing().run();
      await database.insert(forecastSubmissions).values({ id:'forecast-d1', orgId:'org_a', period:'2026-Q4', snapshot:JSON.stringify({ committed:15000 }), createdBy:'manager', createdAt:now }).onConflictDoNothing().run();
      await env.DB.batch(REVENUE_MIGRATIONS.map(statement => env.DB.prepare(statement)));
      const saved = await database.select().from(forecastSubmissions).where(eq(forecastSubmissions.orgId,'org_a')).get();
      const other = await database.select().from(forecastSubmissions).where(eq(forecastSubmissions.orgId,'org_b')).all();
      return Response.json({ inserts:inserts.flat().length, updates:updates.flat().length, foreign:foreign.length, committed:JSON.parse(saved.snapshot).committed, target:saved.target, other:other.length });
    }
    if (url.pathname === '/crm-export') {
      const id = await createCrmNote(url.searchParams.get('provider'), 'fixture-key', { kind:'deal', externalId:'123' }, { title:'Discovery', text:'Follow up <script>unsafe</script>', createdAt:new Date().toISOString(), callUrl:'https://coach.example.com/app/calls/123' });
      return Response.json({ exported:!!id });
    }
    if (url.pathname === '/automation-export') {
      const id = await sendAutomationEvent('zapier', 'https://hooks.zapier.com/hooks/catch/123/fixture/', 'event-fixture', { eventId:'event-fixture', event:'call.shared' });
      return Response.json({ eventId:id });
    }
    if (url.pathname === '/integration-schema') {
      await env.DB.prepare('CREATE TABLE IF NOT EXISTS calls (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, created_at TEXT NOT NULL)').run();
      await env.DB.batch(REVENUE_MIGRATIONS.map(statement => env.DB.prepare(statement)));
      const database = drizzle(env.DB);
      const now = new Date().toISOString();
      const task = { id:'task-d1', orgId:'org_a', connectionId:'conn', provider:'asana', externalId:'1', title:'Follow up', status:'open', syncedAt:now };
      await database.insert(externalTasks).values(task).onConflictDoNothing().run();
      await database.insert(externalTasks).values({ ...task, title:'Updated follow-up' }).onConflictDoUpdate({ target:externalTasks.id, set:{ title:'Updated follow-up' } }).run();
      await database.insert(taskExports).values({ id:'export-d1', orgId:'org_a', connectionId:'conn', callId:'call', actionId:'action', title:'Follow up', createdAt:now, updatedAt:now }).onConflictDoNothing().run();
      const claims = await Promise.all(Array.from({ length:24 }, () => database.update(taskExports).set({ status:'sending' }).where(and(eq(taskExports.id,'export-d1'),eq(taskExports.orgId,'org_a'),eq(taskExports.status,'queued'))).returning({ id:taskExports.id }).all()));
      await database.insert(integrationExports).values({ id:'call-export-d1', orgId:'org_a', connectionId:'conn', callId:'call', event:'call.shared', createdAt:now, updatedAt:now }).onConflictDoNothing().run();
      const exportClaims = await Promise.all(Array.from({ length:24 }, () => database.update(integrationExports).set({ status:'sending' }).where(and(eq(integrationExports.id,'call-export-d1'),eq(integrationExports.orgId,'org_a'),eq(integrationExports.status,'queued'))).returning({ id:integrationExports.id }).all()));
      await database.insert(callProviderInsights).values({ callId:'call', orgId:'org_a', data:JSON.stringify({ outcome:'Meeting booked' }) }).run();
      await env.DB.batch(REVENUE_MIGRATIONS.map(statement => env.DB.prepare(statement)));
      const insight = await database.select().from(callProviderInsights).where(eq(callProviderInsights.orgId,'org_a')).get();
      const tasks = await database.select().from(externalTasks).where(eq(externalTasks.orgId,'org_a')).all();
      const other = await database.select().from(externalTasks).where(eq(externalTasks.orgId,'org_b')).all();
      return Response.json({ count:tasks.length, title:tasks[0].title, claims:claims.flat().length, exportClaims:exportClaims.flat().length, outcome:JSON.parse(insight.data).outcome, other:other.length });
    }
    if (url.pathname === '/body') return Response.json(await (await boundedRequest(request, 1024)).json());
    if (url.pathname === '/credentials') {
      const sealed = encryptCredentials({ value: 'fixture-key' }, 'setting:t:org_a:ai_api_key');
      const recovered = decryptCredentials(sealed, 'setting:t:org_a:ai_api_key').value;
      let isolated = false;
      try { decryptCredentials(sealed, 'setting:t:org_b:ai_api_key'); } catch { isolated = true; }
      return Response.json({ recovered: recovered === 'fixture-key', encrypted: !sealed.includes('fixture-key'), isolated });
    }
    if (url.pathname === '/ai') {
      await pingProvider(url.searchParams.get('provider'), 'fixture-key', 'fixture-model');
      return Response.json({ verified: true });
    }
    if (url.pathname === '/audio') {
      const kind = url.searchParams.get('provider');
      const result = await transcribeAudio({ bytes: new Uint8Array([1,2,3]), fileName: 'fixture.mp3', mimeType: 'audio/mpeg' }, {kind, apiKey:'fixture-key',model:'fixture-model'});
      return Response.json({ transcribed: result.transcriptText.includes('Hello') });
    }
    const data = await providerRequest('Fixture', 'https://vendor.invalid', url.pathname, { Authorization:'Bearer fixture-key' });
    return Response.json(data);
  } catch (error) { return Response.json({ error: error.message, providerStatus: error.providerStatus }, { status: error.status || 500 }); }
}};
`;

let runtime;
const requests = [];
before(async () => {
  const config = await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8");
  const compatibilityDate = config.match(/"compatibility_date"\s*:\s*"([^"]+)"/)[1];
  const compatibilityFlags = JSON.parse(config.match(/"compatibility_flags"\s*:\s*(\[[\s\S]*?\])/)[1]);
  const bundle = await build({
    stdin: { contents: workerSource, resolveDir: process.cwd(), loader: "ts" },
    bundle: true, platform: "node", format: "esm", write: false, logLevel: "error",
    external: ["@opennextjs/cloudflare", "better-sqlite3"],
    banner: { js: "var __dirname = '.';" },
  });
  runtime = new Miniflare(convertV4MiniflareOptions({
    modules: true, script: bundle.outputFiles[0].text, compatibilityDate, compatibilityFlags,
    d1Databases: ['DB'],
    bindings: { NODE_ENV: "production", INTEGRATION_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString("base64") },
    outboundService: async request => {
      const url = new URL(request.url);
      requests.push(url.href);
      if (['api.hubapi.com','api.pipedrive.com','api.attio.com'].includes(url.hostname)) {
        const body = await request.json();
        assert.ok(JSON.stringify(body).includes('Open Sales Coach call'));
        if (url.hostname === 'api.hubapi.com') { assert.equal(request.headers.get('authorization'),'Bearer fixture-key'); assert.equal(body.associations[0].types[0].associationTypeId,214); return WorkerResponse.json({ id:'note' }); }
        if (url.hostname === 'api.pipedrive.com') { assert.equal(request.headers.get('x-api-token'),'fixture-key'); assert.equal(body.deal_id,123); return WorkerResponse.json({ success:true, data:{ id:123 } }); }
        assert.equal(body.data.parent_object,'deals'); return WorkerResponse.json({ data:{ id:{ note_id:'note' } } });
      }
      if (url.hostname === 'hooks.zapier.com') { assert.equal(request.headers.get('x-sales-coach-event-id'),'event-fixture'); return new WorkerResponse('accepted'); }
      if (url.hostname === "vendor.invalid") {
        if (url.pathname === "/redirect") return new WorkerResponse(null, { status: 302, headers: { location: "https://untrusted.invalid/credential" } });
        if (url.pathname === "/invalid-key") return WorkerResponse.json({ error: "fixture-key must not appear in the response" }, { status: 401 });
        return WorkerResponse.json({ verified: true });
      }
      assert.ok(["generativelanguage.googleapis.com", "api.openai.com", "api.anthropic.com", "api.groq.com", "openrouter.ai"].includes(url.hostname), "No real vendor calls or unexpected redirect destinations");
      const body = await request.text();
      const audio = url.pathname.includes("/audio/transcriptions") || body.includes("inlineData");
      const text = audio ? "[0:00] Rep: Hello." : '{"ok":true}';
      return WorkerResponse.json({
        candidates: [{ content: { parts: [{ text }] } }],
        choices: [{ message: { content: text } }], content: [{ type: "text", text }],
        text: "Hello.", segments: [{ start: 0, text: "Hello." }],
      });
    },
  }));
});
after(async () => { await runtime?.dispose(); });

test("Workers accepts bounded settings bodies and round-trips encrypted credentials", async () => {
  const body = await runtime.dispatchFetch("http://localhost/body", { method: "POST", body: JSON.stringify({ apiKey: "fixture-key" }) });
  assert.equal(body.status, 200);
  assert.deepEqual(await body.json(), { apiKey: "fixture-key" });
  const encrypted = await runtime.dispatchFetch("http://localhost/credentials");
  assert.equal(encrypted.status, 200);
  assert.deepEqual(await encrypted.json(), { recovered: true, encrypted: true, isolated: true });
});

test("native Workers fetch validates integration credentials and rejects redirects without forwarding keys", async () => {
  const valid = await runtime.dispatchFetch("http://localhost/valid-key");
  assert.equal(valid.status, 200);
  assert.deepEqual(await valid.json(), { verified: true });
  const invalid = await runtime.dispatchFetch("http://localhost/invalid-key");
  assert.equal(invalid.status, 400);
  assert.match((await invalid.json()).error, /check the credential/);
  const redirect = await runtime.dispatchFetch("http://localhost/redirect");
  assert.equal(redirect.status, 502);
  assert.equal((await redirect.json()).providerStatus, 302);
  assert.ok(!requests.some(url => url.includes("untrusted.invalid")));
});

test("all AI key checks and supported transcription providers run in Workers", async () => {
  for (const provider of ["gemini", "openai", "anthropic", "groq", "openrouter"]) {
    const response = await runtime.dispatchFetch(`http://localhost/ai?provider=${provider}`);
    assert.equal(response.status, 200, provider);
    assert.deepEqual(await response.json(), { verified: true });
  }
  for (const provider of ["gemini", "openai", "groq"]) {
    const response = await runtime.dispatchFetch(`http://localhost/audio?provider=${provider}`);
    assert.equal(response.status, 200, provider);
    assert.deepEqual(await response.json(), { transcribed: true });
  }
});

test("D1 integration migrations preserve task/call data and allow exactly one of 24 concurrent claims per delivery", async () => {
  const response = await runtime.dispatchFetch("http://localhost/integration-schema");
  assert.equal(response.status, 200, await response.clone().text());
  assert.deepEqual(await response.json(), { count: 1, title: "Updated follow-up", claims: 1, exportClaims: 1, outcome: "Meeting booked", other: 0 });
});

test("D1 deal reviews reject concurrent writes and forecast snapshots survive retries and repeated migrations", async () => {
  const response = await runtime.dispatchFetch("http://localhost/forecast-storage");
  assert.equal(response.status, 200, await response.clone().text());
  assert.deepEqual(await response.json(), { inserts:1, updates:1, foreign:0, committed:10000, target:'20000', other:0 });
});

test("CRM notes and outbound automation events work with native Workers fetch", async () => {
  for (const provider of ['hubspot','pipedrive','attio']) {
    const response = await runtime.dispatchFetch(`http://localhost/crm-export?provider=${provider}`);
    assert.equal(response.status,200,await response.clone().text()); assert.deepEqual(await response.json(),{ exported:true });
  }
  const response = await runtime.dispatchFetch('http://localhost/automation-export');
  assert.equal(response.status,200,await response.clone().text()); assert.deepEqual(await response.json(),{ eventId:'event-fixture' });
});
