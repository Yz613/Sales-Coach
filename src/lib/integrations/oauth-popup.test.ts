import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { integrationTool } from "./catalog";
import {
  INTEGRATION_OAUTH_CHANNEL,
  INTEGRATION_OAUTH_POPUP,
  INTEGRATION_OAUTH_POPUP_FLAG,
  INTEGRATION_OAUTH_STORAGE_KEY,
  OAUTH_POPUP_DONE,
  OAUTH_POPUP_PROGRESS,
  OAUTH_POPUP_WAITING,
  closeIntegrationOAuthPopup,
  createIntegrationOAuthSignal,
  deliverIntegrationOAuthUrl,
  handleIntegrationOAuthReturn,
  integrationOAuthPopupProgress,
  integrationOAuthStatus,
  openIntegrationOAuthTab,
  parseIntegrationOAuthSignal,
  publishIntegrationOAuthSignal,
  readStoredIntegrationOAuthSignal,
  subscribeIntegrationOAuth,
  type IntegrationOAuthSignal,
  type OAuthPopupWindow,
} from "./oauth-popup";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

type TestPopup = OAuthPopupWindow & {
  opener: { postMessage: (message: unknown, targetOrigin: string) => void } | null;
  location: { href: string; origin: string };
  sessionStorage: ReturnType<typeof memoryStorage>;
  document: { title: string; body: { textContent: string | null } };
  posted: { message: unknown; origin: string }[];
};

function popupWindow(overrides: Partial<TestPopup> = {}): TestPopup {
  const session = memoryStorage();
  const posted: { message: unknown; origin: string }[] = [];
  const popup: TestPopup = {
    opener: { postMessage: (message: unknown, origin: string) => { posted.push({ message, origin }); } },
    closed: false,
    name: "",
    location: { href: "about:blank", origin: "https://refreshqueue.com" },
    close() { popup.closed = true; },
    sessionStorage: session,
    document: { title: "", body: { textContent: null } },
    posted,
    ...overrides,
  };
  return popup;
}

function eventHost() {
  const listeners = new Map<string, Set<(event: { data?: unknown; origin?: string; key?: string | null; newValue?: string | null }) => void>>();
  return {
    addEventListener(type: string, listener: (event: { data?: unknown; origin?: string; key?: string | null; newValue?: string | null }) => void) {
      const set = listeners.get(type) ?? new Set();
      set.add(listener);
      listeners.set(type, set);
    },
    removeEventListener(type: string, listener: (event: { data?: unknown; origin?: string; key?: string | null; newValue?: string | null }) => void) {
      listeners.get(type)?.delete(listener);
    },
    emit(type: string, event: { data?: unknown; origin?: string; key?: string | null; newValue?: string | null }) {
      for (const listener of listeners.get(type) ?? []) listener(event);
    },
    size(type: string) { return listeners.get(type)?.size ?? 0; },
  };
}

class FakeChannel {
  static open = new Map<string, Set<FakeChannel>>();
  onmessage: ((event: { data: unknown }) => void) | null = null;
  constructor(public name: string) {
    const peers = FakeChannel.open.get(name) ?? new Set<FakeChannel>();
    peers.add(this);
    FakeChannel.open.set(name, peers);
  }
  postMessage(data: unknown) {
    for (const peer of FakeChannel.open.get(this.name) ?? []) {
      if (peer !== this) peer.onmessage?.({ data });
    }
  }
  close() { FakeChannel.open.get(this.name)?.delete(this); }
}

describe("integration OAuth popup", { concurrency: false }, () => {
test("provider sign-in opens synchronously without noopener and severs the opener", () => {
  const popup = popupWindow();
  const opened = openIntegrationOAuthTab((url, target, features) => {
    assert.deepEqual([url, target, features], ["about:blank", INTEGRATION_OAUTH_POPUP, undefined]);
    assert.equal(features?.includes("noopener"), undefined);
    popup.name = target;
    return popup;
  });
  assert.equal(opened, popup);
  assert.equal(popup.opener, null);
  assert.equal(popup.name, INTEGRATION_OAUTH_POPUP);
  assert.equal(popup.sessionStorage.getItem(INTEGRATION_OAUTH_POPUP_FLAG), "1");
  assert.equal(popup.document.title, "Connecting");
});

test("noopener would hide the new tab, so a blocked popup stays on this page", () => {
  const live = popupWindow();
  const opened = openIntegrationOAuthTab((url, target, features) => features?.includes("noopener") ? null : (assert.equal(target, INTEGRATION_OAUTH_POPUP), assert.equal(url, "about:blank"), live));
  assert.equal(opened, live);
  const blocked = openIntegrationOAuthTab(() => null);
  assert.equal(blocked, null);
  let assigned = "";
  const mode = deliverIntegrationOAuthUrl(blocked, "https://accounts.example/authorize", (url) => { assigned = url; });
  assert.equal(mode, "same-tab");
  assert.equal(assigned, "https://accounts.example/authorize");
});

test("a closed sign-in tab falls back to this page and a live tab is navigated", () => {
  const closed = popupWindow({ closed: true });
  let assigned = "";
  assert.equal(deliverIntegrationOAuthUrl(closed, "https://accounts.example/authorize", (url) => { assigned = url; }), "same-tab");
  assert.equal(assigned, "https://accounts.example/authorize");
  const live = popupWindow();
  assigned = "";
  assert.equal(deliverIntegrationOAuthUrl(live, "https://accounts.example/authorize", (url) => { assigned = url; }), "popup");
  assert.equal(assigned, "");
  assert.equal(live.location.href, "https://accounts.example/authorize");
  assert.equal(live.closed, false);
});

test("a sign-in tab that cannot navigate is closed before this page continues", () => {
  const popup = popupWindow();
  Object.defineProperty(popup.location, "href", { set() { throw new Error("blocked"); } });
  let assigned = "";
  assert.equal(deliverIntegrationOAuthUrl(popup, "https://accounts.example/authorize", (url) => { assigned = url; }), "same-tab");
  assert.equal(popup.closed, true);
  assert.equal(assigned, "https://accounts.example/authorize");
});

test("automatic refresh is promised only when the original tab can hear the result", () => {
  assert.equal(integrationOAuthPopupProgress(true), OAUTH_POPUP_PROGRESS);
  assert.equal(OAUTH_POPUP_PROGRESS, "Complete sign-in in the new tab — this page refreshes automatically.");
  assert.equal(integrationOAuthPopupProgress(false), OAUTH_POPUP_WAITING);
  assert.equal(OAUTH_POPUP_WAITING.includes("automatically"), false);
});

test("the callback tab tells the original tab and closes, or shows that it can be closed", () => {
  const storage = memoryStorage();
  const host = eventHost();
  const heard: IntegrationOAuthSignal[] = [];
  const subscription = subscribeIntegrationOAuth((signal) => heard.push(signal), {
    host, origin: "https://refreshqueue.com", BroadcastChannel: FakeChannel, onFocus: () => heard.push(createIntegrationOAuthSignal({ provider: "focus", connected: "1", sync: null, connectionError: null }, 1)),
  });
  assert.equal(subscription.refreshesAutomatically, true);
  const popup = popupWindow();
  openIntegrationOAuthTab(() => popup);
  const done = handleIntegrationOAuthReturn(popup, new URLSearchParams("connected=1&sync=held"), "gmail", {
    origin: "https://refreshqueue.com", BroadcastChannel: FakeChannel, storage, now: () => 50,
  });
  assert.equal(done.popup, true);
  assert.equal(done.closed, true);
  assert.equal(done.notice, null);
  assert.equal(heard.length, 1);
  assert.equal(heard[0].provider, "gmail");
  assert.equal(heard[0].sync, "held");
  assert.equal(popup.posted.length, 0);
  host.emit("message", { origin: "https://elsewhere.example", data: heard[0] });
  host.emit("message", { origin: "https://refreshqueue.com", data: heard[0] });
  assert.equal(heard.length, 1);
  const stored = readStoredIntegrationOAuthSignal(storage);
  assert.equal(stored?.provider, "gmail");
  host.emit("storage", { key: INTEGRATION_OAUTH_STORAGE_KEY, newValue: JSON.stringify(stored) });
  assert.equal(heard.length, 1);

  const stuck = popupWindow({ name: INTEGRATION_OAUTH_POPUP });
  stuck.close = () => { /* The browser kept the tab open. */ };
  const visible = handleIntegrationOAuthReturn(stuck, new URLSearchParams("connected=1"), "hubspot", {
    origin: "https://refreshqueue.com", BroadcastChannel: null, storage: memoryStorage(), now: () => 60,
  });
  assert.equal(visible.closed, false);
  assert.deepEqual(visible.notice, { message: OAUTH_POPUP_DONE });
  assert.equal(OAUTH_POPUP_DONE, "Connected, you can close this tab.");

  const failed = popupWindow({ name: "" });
  failed.sessionStorage.setItem(INTEGRATION_OAUTH_POPUP_FLAG, "1");
  const error = handleIntegrationOAuthReturn(failed, new URLSearchParams("connectionError=Sign-in+was+cancelled."), "microsoft-teams", {
    origin: "https://refreshqueue.com", BroadcastChannel: null, storage: memoryStorage(), now: () => 70,
  });
  assert.equal(error.closed, false);
  assert.equal(failed.closed, false);
  assert.match(error.notice?.error || "", /Sign-in was cancelled\./);
  assert.match(error.notice?.error || "", /You can close this tab\./);
  subscription.stop();
  assert.equal(host.size("message"), 0);
  assert.equal(host.size("focus"), 0);
});

test("the original page keeps the same connection message when sign-in stays in this tab", () => {
  const sameTab = popupWindow({ name: "refresh-queue" });
  const result = handleIntegrationOAuthReturn(sameTab, new URLSearchParams("connected=setup"), "asana", { BroadcastChannel: null, storage: memoryStorage() });
  assert.equal(result.popup, false);
  assert.equal(result.signal, null);
  assert.equal(sameTab.closed, false);
  assert.equal(result.notice?.message, "Account connected. Choose a task destination below to finish setup.");
  assert.equal(integrationOAuthStatus({ provider: "gmail", connected: "1", sync: "held", connectionError: null }).message, "Connected. Turn on email capture in Admin settings to import messages.");
  assert.equal(integrationOAuthStatus({ provider: "slack", connected: "1", sync: null, connectionError: null }).message, "Channel connected. Enable your preferred alerts below.");
  assert.equal(integrationOAuthStatus({ provider: "google-meet", connected: "1", sync: null, connectionError: null }).message, "Connected. Your first import is queued.");
  assert.equal(integrationOAuthStatus({ provider: "outlook", connected: null, sync: null, connectionError: "Access was declined." }).error, "Access was declined.");
  assert.equal(parseIntegrationOAuthSignal({ type: "other" }), null);
  const longError = parseIntegrationOAuthSignal({ type: "refreshqueue-integration-oauth", id: "90-outlook", at: 90, provider: "outlook", connected: null, sync: null, connectionError: `${"x".repeat(600)} tail` });
  assert.equal(longError?.connectionError?.length, 500);
  assert.equal(longError?.connectionError?.includes("tail"), false);
  closeIntegrationOAuthPopup(null);
  closeIntegrationOAuthPopup({ close() { throw new Error("already closed"); } });
});

test("BroadcastChannel and focus can refresh the original tab without an opener", () => {
  const host = eventHost();
  const heard: string[] = [];
  let focused = 0;
  const silent = subscribeIntegrationOAuth(() => heard.push("nope"), {
    host: { addEventListener() { throw new Error("unavailable"); }, removeEventListener() { throw new Error("unavailable"); } },
    origin: "https://refreshqueue.com",
    BroadcastChannel: null,
  });
  assert.equal(silent.refreshesAutomatically, false);
  silent.stop();
  const subscription = subscribeIntegrationOAuth((signal) => heard.push(signal.provider), {
    host, origin: "https://refreshqueue.com", BroadcastChannel: FakeChannel, onFocus: () => { focused += 1; },
  });
  const signal = createIntegrationOAuthSignal({ provider: "outlook", connected: "1", sync: null, connectionError: null }, 80);
  const delivered = publishIntegrationOAuthSignal(signal, { BroadcastChannel: FakeChannel, storage: memoryStorage(), opener: null });
  assert.equal(delivered.channel, true);
  assert.equal(delivered.postMessage, false);
  assert.deepEqual(heard, ["outlook"]);
  publishIntegrationOAuthSignal(signal, { BroadcastChannel: FakeChannel, storage: memoryStorage() });
  assert.deepEqual(heard, ["outlook"]);
  host.emit("focus", {});
  assert.equal(focused, 1);
  assert.equal(subscription.refreshesAutomatically, true);
  subscription.stop();
  assert.equal(FakeChannel.open.get(INTEGRATION_OAUTH_CHANNEL)?.size ?? 0, 0);
});

test("HubSpot, Gmail, Outlook, Meet, and Teams connect through the shared sign-in tab", () => {
  for (const provider of ["hubspot", "gmail", "outlook", "outlook-calendar", "google-meet", "microsoft-teams"] as const) {
    assert.equal(integrationTool(provider)?.oauth, provider);
  }
  assert.equal(integrationTool("zoom")?.oauth, "zoom");
  const hub = fs.readFileSync(path.join(process.cwd(), "src/components/revenue/IntegrationHub.tsx"), "utf8");
  const helper = fs.readFileSync(path.join(process.cwd(), "src/lib/integrations/oauth-popup.ts"), "utf8");
  assert.equal((hub.match(/beginOAuth\(/g) || []).length, 3);
  assert.match(hub, /openIntegrationOAuthTab\(\(url, target\) => window\.open\(url, target\)\)/);
  assert.match(hub, /window\.location\.assign\(url\)/);
  assert.equal(hub.includes("noopener"), false);
  assert.match(helper, /open\("about:blank", INTEGRATION_OAUTH_POPUP\)/);
  assert.equal(helper.includes("zoom"), false);
  assert.equal(fs.readFileSync(path.join(process.cwd(), "src/lib/integrations/zoom.ts"), "utf8").includes("openIntegrationOAuthTab"), false);
});
});
