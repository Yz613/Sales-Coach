/** Verify both login bundles without logging credentials or response bodies. */
async function loginAssetsHealthy(origin, fetch) {
  for (const path of ["/app/__auth/assets/session@6/sdk.js", "/app/__auth/assets/interface@1/ui.js"]) {
    let url = new URL(path, origin);
    let loaded = false;
    for (let hop = 0; hop < 5; hop++) {
      const response = await fetch(url.href, { cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(30000) });
      await response.body?.cancel();
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location) return false;
        const target = new URL(location, url);
        if (target.origin !== origin || !target.pathname.startsWith("/app/__auth/assets/") || target.href === url.href) return false;
        url = target;
        continue;
      }
      loaded = response.status === 200 && /(?:application|text)\/(?:javascript|x-javascript)/i.test(response.headers.get("content-type") || "");
      break;
    }
    if (!loaded) return false;
  }
  return true;
}

async function main(options = {}) {
  const env = options.env || process.env;
  const fetch = options.fetch || globalThis.fetch;
  const delay = options.delay || (ms => new Promise(resolve => setTimeout(resolve, ms)));
  if (!env.PUBLIC_APP_URL) throw new Error("PUBLIC_APP_URL is required to verify deployed login assets.");
  const origin = new URL(env.PUBLIC_APP_URL).origin;
  if (!origin.startsWith("https://")) throw new Error("Deployed login verification requires HTTPS.");
  // Edge locations can briefly serve the preceding version during a rollout.
  for (let attempt = 0; attempt < 5; attempt++) {
    if (await loginAssetsHealthy(origin, fetch).catch(() => false)) {
      console.log("Both first-party login bundles and their redirects verified.");
      return;
    }
    if (attempt < 4) await delay(10000);
  }
  throw new Error("Deployed login bundles failed verification. Check the authentication proxy configuration.");
}

module.exports = { main, loginAssetsHealthy };
if (require.main === module) main().catch(error => {
  console.error(error instanceof Error ? error.message : "Login verification failed.");
  process.exitCode = 1;
});
