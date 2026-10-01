import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

/** Host-operator migration; never exposed through an HTTP endpoint. Back up storage and the encryption key first. */
async function main() {
  const { db, ensureRevenueSchema } = await import("../src/lib/db");
  const { appSettings, calls, integrationConnections } = await import("../src/lib/db/schema");
  const { isSecretSetting, openSetting, sealSetting } = await import("../src/lib/setting-secrets");
  const { readCallAudio, saveCallAudio, isStoredCallAudioUrl, removeLegacyCallAudio } = await import("../src/lib/callAudioStore");
  const { runWithTenant } = await import("../src/lib/tenant");
  const { encryptionKey, decryptCredentials } = await import("../src/lib/revenue/security");
  const { eq, and } = await import("drizzle-orm");
  encryptionKey();
  await ensureRevenueSchema();
  for (const row of await db.select().from(integrationConnections).all()) {
    if (row.credentials) decryptCredentials(row.credentials, `${row.orgId}:${row.id}`);
  }
  const settingRows = await db.select().from(appSettings).all();
  for (const row of settingRows) if (isSecretSetting(row.key) && row.value.startsWith("v1.")) openSetting(row.key, row.value);
  let settings = 0; let recordings = 0; let unavailable = 0;
  for (const row of settingRows) {
    if (!isSecretSetting(row.key) || !row.value || row.value.startsWith("v1.")) continue;
    await db.update(appSettings).set({ value: sealSetting(row.key, openSetting(row.key, row.value)), updatedAt: new Date().toISOString() })
      .where(and(eq(appSettings.key, row.key), eq(appSettings.value, row.value))).run();
    settings++;
  }
  const rows = await db.select({ id: calls.id, orgId: calls.orgId, audioUrl: calls.audioUrl }).from(calls).all();
  for (const row of rows) {
    if (!isStoredCallAudioUrl(row.audioUrl) && !/^\/recordings\/call_0[1-4]\.mp3$/.test(row.audioUrl || "")) continue;
    await runWithTenant(row.orgId, async () => {
      const audio = await readCallAudio(row.id);
      if (!audio) { unavailable++; return; }
      const url = await saveCallAudio(row.id, audio.bytes, audio.mimeType, audio.fileName);
      await db.update(calls).set({ audioUrl: url }).where(and(eq(calls.id, row.id), eq(calls.orgId, row.orgId))).run();
      removeLegacyCallAudio(row.id);
      recordings++;
    });
  }
  console.log(JSON.stringify({ encryptedSettings: settings, rewrittenEncryptedRecordings: recordings, unavailableRecordings: unavailable }));
  if (unavailable) process.exitCode = 1;
}
main().catch(() => { console.error("Storage encryption migration failed. Verify storage access and the original encryption key."); process.exitCode = 1; });
