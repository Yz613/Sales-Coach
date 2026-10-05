import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  MEASUREMENT_ID,
  TAG_SCRIPT_SRC,
  fallbackContentSecurityPolicy,
  pageViewBootstrap,
  pageViewParams,
  sendPageView,
  tagConnectHosts,
  tagImgHosts,
  tagScriptHosts,
} from "./page-views";

describe("page view tag", () => {
  it("uses the public Refresh Queue measurement id", () => {
    assert.equal(MEASUREMENT_ID, "G-SRZXYYBKMT");
    assert.equal(TAG_SCRIPT_SRC, "https://www.googletagmanager.com/gtag/js?id=G-SRZXYYBKMT");
    const bootstrap = pageViewBootstrap();
    assert.match(bootstrap, /G-SRZXYYBKMT/);
    assert.match(bootstrap, /send_page_view:false/);
    assert.doesNotMatch(bootstrap, /<\/script/i);
    assert.equal(pageViewBootstrap("not-an-id"), "try{}catch(e){}");
  });

  it("defines the tag without throwing when the library is blocked", () => {
    const sandbox = {
      document: { title: "Pricing" },
      location: {
        href: "https://refreshqueue.com/#pricing",
        pathname: "/",
        search: "",
        hash: "#pricing",
      },
    } as Record<string, unknown>;
    sandbox.window = sandbox;
    assert.doesNotThrow(() => vm.runInNewContext(pageViewBootstrap(), sandbox));
    const queued = sandbox.dataLayer as unknown[][];
    assert.equal(queued.length, 2);
    assert.equal(queued[1]?.[0], "config");
    assert.equal(queued[1]?.[1], MEASUREMENT_ID);
    assert.equal((queued[1]?.[2] as { send_page_view?: boolean }).send_page_view, false);

    const blocked = {} as Record<string, unknown>;
    Object.defineProperty(blocked, "dataLayer", {
      set() {
        throw new Error("blocked");
      },
    });
    const broken = { window: blocked, document: { title: "" }, location: sandbox.location };
    assert.doesNotThrow(() => vm.runInNewContext(pageViewBootstrap(), broken));
  });

  it("records the browser URL and ignores a missing tag", () => {
    const location = {
      href: "https://refreshqueue.com/integrations?src=nav",
      pathname: "/integrations",
      search: "?src=nav",
      hash: "",
    };
    const calls: unknown[][] = [];
    assert.equal(sendPageView((...args) => calls.push(args), location, "Integrations"), true);
    assert.deepEqual(calls, [["event", "page_view", pageViewParams(location, "Integrations")]]);
    assert.equal(calls[0]?.[2] && (calls[0][2] as { page_path: string }).page_path, "/integrations?src=nav");
    assert.equal(sendPageView(undefined, location, "Integrations"), false);
    assert.equal(
      sendPageView(() => {
        throw new Error("blocked");
      }, location, "Integrations"),
      false
    );
  });

  it("allows the tag in the fallback content security policy", () => {
    const policy = fallbackContentSecurityPolicy("abc+/=", false);
    assert.ok(
      policy.includes(
        "script-src 'self' 'nonce-abc+/=' 'strict-dynamic' https://www.googletagmanager.com https://*.googletagmanager.com"
      )
    );
    for (const host of [...tagScriptHosts, ...tagConnectHosts, ...tagImgHosts]) {
      assert.ok(policy.includes(host), host);
    }
    assert.ok(policy.includes("connect-src 'self' https://www.googletagmanager.com"));
    assert.equal(policy.includes("unsafe-eval"), false);
    assert.equal(policy.includes(" ws:"), false);
    const dev = fallbackContentSecurityPolicy("n", true);
    assert.match(dev, /'unsafe-eval'/);
    assert.match(dev, /connect-src 'self' ws:/);
  });

  it("renders the measurement id from the root layout", () => {
    const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
    const middleware = readFileSync(new URL("../middleware.ts", import.meta.url), "utf8");
    assert.match(layout, /src=\{TAG_SCRIPT_SRC\}/);
    assert.match(layout, /pageViewBootstrap\(\)/);
    assert.match(layout, /<PageViewTracker \/>/);
    assert.match(middleware, /fallbackContentSecurityPolicy/);
    assert.match(middleware, /tagScriptHosts/);
    assert.match(middleware, /tagConnectHosts/);
    assert.match(middleware, /tagImgHosts/);
  });

  it("merges the tag hosts into Clerk's strict content security policy", () => {
    const require = createRequire(import.meta.url);
    const { createContentSecurityPolicyHeaders } = require(
      "../../node_modules/@clerk/nextjs/dist/cjs/server/content-security-policy.js"
    ) as {
      createContentSecurityPolicyHeaders: (
        host: string,
        options: { strict: boolean; directives: Record<string, string[]> }
      ) => { headers: [string, string][] };
    };
    const { headers } = createContentSecurityPolicyHeaders("clerk.example.com", {
      strict: true,
      directives: {
        "object-src": ["'none'"],
        "base-uri": ["'self'"],
        "frame-ancestors": ["'none'"],
        "media-src": ["'self'", "https:", "blob:"],
        "script-src": [...tagScriptHosts],
        "connect-src": [...tagConnectHosts],
        "img-src": ["'self'", "https://img.clerk.com", "data:", ...tagImgHosts],
      },
    });
    const policy = headers.find(([name]) => name.toLowerCase() === "content-security-policy")?.[1] || "";
    assert.match(policy, /'strict-dynamic'/);
    assert.match(policy, /'nonce-/);
    for (const host of [...tagScriptHosts, ...tagConnectHosts, ...tagImgHosts]) {
      assert.ok(policy.includes(host), host);
    }
    assert.match(policy, /https:\/\/img\.clerk\.com/);
    assert.match(policy, /frame-ancestors 'none'/);
  });
});
