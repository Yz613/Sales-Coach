import { isNotificationTool } from "./catalog";

/** Named browsing context for provider sign-in. `window.open` must not use `noopener`: that feature makes `window.open` return null, so the caller cannot navigate the new tab and falls back to same-tab navigation. */
export const INTEGRATION_OAUTH_POPUP = "refreshqueue-integration-oauth";
export const INTEGRATION_OAUTH_POPUP_FLAG = "refreshqueue-integration-oauth-popup";
export const INTEGRATION_OAUTH_CHANNEL = "refreshqueue-integration-oauth";
export const INTEGRATION_OAUTH_STORAGE_KEY = "refreshqueue-integration-oauth-result";
export const INTEGRATION_OAUTH_SIGNAL = "refreshqueue-integration-oauth";

export const OAUTH_POPUP_PROGRESS = "Complete sign-in in the new tab — this page refreshes automatically.";
export const OAUTH_POPUP_WAITING = "Complete sign-in in the new tab.";
export const OAUTH_POPUP_DONE = "Connected, you can close this tab.";

export type IntegrationOAuthSignal = {
  type: typeof INTEGRATION_OAUTH_SIGNAL;
  id: string;
  at: number;
  provider: string;
  connected: string | null;
  sync: string | null;
  connectionError: string | null;
};

export type OAuthPopupWindow = {
  opener: unknown;
  closed: boolean;
  name: string;
  location: { href: string };
  close: () => void;
  sessionStorage?: {
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
    removeItem: (key: string) => void;
  };
  document?: { title: string; body: { textContent: string | null } | null };
};

type OAuthChannel = {
  postMessage: (data: unknown) => void;
  close: () => void;
  // DOM BroadcastChannel and test doubles both assign this.
  onmessage: any;
};

export type OAuthPopupPublishDeps = {
  opener?: { postMessage: (message: unknown, targetOrigin: string) => void } | null;
  origin?: string;
  BroadcastChannel?: (new (name: string) => OAuthChannel) | null;
  storage?: { setItem: (key: string, value: string) => void; getItem?: (key: string) => string | null };
  now?: () => number;
};

type HostEvent = { data?: unknown; origin?: string; key?: string | null; newValue?: string | null };

export type OAuthListenerHost = {
  addEventListener: (type: string, listener: (event: HostEvent) => void) => void;
  removeEventListener: (type: string, listener: (event: HostEvent) => void) => void;
};

export function integrationOAuthPopupProgress(refreshesAutomatically: boolean) {
  return refreshesAutomatically ? OAUTH_POPUP_PROGRESS : OAUTH_POPUP_WAITING;
}

export function integrationOAuthStatus(outcome: { provider: string; connected: string | null; sync: string | null; connectionError: string | null }) {
  if (outcome.connectionError) return { error: outcome.connectionError };
  if (!outcome.connected) return {};
  if (outcome.connected === "setup") return { message: "Account connected. Choose a task destination below to finish setup." };
  if (outcome.sync === "held") return { message: "Connected. Turn on email capture in Admin settings to import messages." };
  if (isNotificationTool(outcome.provider)) return { message: "Channel connected. Enable your preferred alerts below." };
  return { message: "Connected. Your first import is queued." };
}

export function readIntegrationOAuthOutcome(params: URLSearchParams, provider: string) {
  const connected = params.get("connected");
  const connectionError = params.get("connectionError");
  if (!connected && !connectionError) return null;
  return { provider, connected, sync: params.get("sync"), connectionError };
}

function bounded(value: unknown, max: number, truncate = false) {
  if (typeof value !== "string" || value.length === 0) return null;
  if (value.length <= max) return value;
  return truncate ? value.slice(0, max) : null;
}

export function parseIntegrationOAuthSignal(value: unknown): IntegrationOAuthSignal | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (record.type !== INTEGRATION_OAUTH_SIGNAL) return null;
  const id = bounded(record.id, 80);
  const provider = bounded(record.provider, 80);
  if (!id || !provider || typeof record.at !== "number" || !Number.isFinite(record.at)) return null;
  const connected = record.connected == null ? null : bounded(record.connected, 40);
  const sync = record.sync == null ? null : bounded(record.sync, 40);
  const connectionError = record.connectionError == null ? null : bounded(record.connectionError, 500, true);
  if (record.connected != null && !connected) return null;
  if (record.sync != null && !sync) return null;
  if (record.connectionError != null && !connectionError) return null;
  if (!connected && !connectionError) return null;
  return { type: INTEGRATION_OAUTH_SIGNAL, id, at: record.at, provider, connected, sync, connectionError };
}

export function createIntegrationOAuthSignal(outcome: { provider: string; connected: string | null; sync: string | null; connectionError: string | null }, now = Date.now()): IntegrationOAuthSignal {
  const at = now;
  return { type: INTEGRATION_OAUTH_SIGNAL, id: `${at}-${outcome.provider}`.slice(0, 80), at, ...outcome };
}

export function openIntegrationOAuthTab(open: (url: string, target: string, features?: string) => OAuthPopupWindow | null) {
  const popup = open("about:blank", INTEGRATION_OAUTH_POPUP);
  if (!popup) return null;
  try { popup.opener = null; } catch { /* The new tab can already be severed from this page. */ }
  try { popup.name = INTEGRATION_OAUTH_POPUP; } catch { /* The window name was set by window.open. */ }
  try { popup.sessionStorage?.setItem(INTEGRATION_OAUTH_POPUP_FLAG, "1"); } catch { /* Session storage can be blocked. The window name still identifies the tab. */ }
  try {
    if (popup.document) popup.document.title = "Connecting";
    if (popup.document?.body) popup.document.body.textContent = "Opening the provider sign-in. This tab closes when the connection finishes.";
  } catch { /* about:blank may not be writable yet. */ }
  return popup;
}

export function deliverIntegrationOAuthUrl(popup: OAuthPopupWindow | null, url: string, assign: (url: string) => void): "popup" | "same-tab" {
  if (popup && !popup.closed) {
    try {
      popup.location.href = url;
      return "popup";
    } catch { /* The new tab could not be navigated. */ }
    try { popup.close(); } catch { /* The blank tab may already be gone. */ }
  }
  assign(url);
  return "same-tab";
}

export function oauthPopupCancelled(popup: { closed: boolean } | null, awaiting: boolean) {
  if (!awaiting || !popup) return false;
  try { return popup.closed; } catch { return false; }
}

export function closeIntegrationOAuthPopup(popup: { close: () => void } | null) {
  if (!popup) return;
  try { popup.close(); } catch { /* A blocked or closed tab does not need another close. */ }
}

export function isIntegrationOAuthPopup(win: { name: string; sessionStorage?: { getItem: (key: string) => string | null } }) {
  if (win.name === INTEGRATION_OAUTH_POPUP) return true;
  try { return win.sessionStorage?.getItem(INTEGRATION_OAUTH_POPUP_FLAG) === "1"; } catch { return false; }
}

function channelConstructor(override: OAuthPopupPublishDeps["BroadcastChannel"] | undefined) {
  if (override === null) return null;
  const Candidate = override ?? (typeof globalThis.BroadcastChannel === "function" ? globalThis.BroadcastChannel : null);
  return Candidate as (new (name: string) => OAuthChannel) | null;
}

export function publishIntegrationOAuthSignal(signal: IntegrationOAuthSignal, deps: OAuthPopupPublishDeps = {}) {
  const delivered = { postMessage: false, channel: false, storage: false };
  if (deps.opener && deps.origin) {
    try { deps.opener.postMessage(signal, deps.origin); delivered.postMessage = true; } catch { /* The opener was severed on purpose. */ }
  }
  const BroadcastChannel = channelConstructor(deps.BroadcastChannel);
  if (BroadcastChannel) {
    try {
      const channel = new BroadcastChannel(INTEGRATION_OAUTH_CHANNEL);
      channel.postMessage(signal);
      channel.close();
      delivered.channel = true;
    } catch { /* BroadcastChannel can be unavailable in private browsing. */ }
  }
  const storage = deps.storage ?? (typeof globalThis.localStorage === "undefined" ? undefined : globalThis.localStorage);
  if (storage) {
    try { storage.setItem(INTEGRATION_OAUTH_STORAGE_KEY, JSON.stringify(signal)); delivered.storage = true; } catch { /* Storage can be full or blocked. */ }
  }
  return delivered;
}

export function readStoredIntegrationOAuthSignal(storage?: { getItem: (key: string) => string | null }): IntegrationOAuthSignal | null {
  try {
    const source = storage ?? globalThis.localStorage;
    const raw = source?.getItem(INTEGRATION_OAUTH_STORAGE_KEY);
    if (!raw) return null;
    return parseIntegrationOAuthSignal(JSON.parse(raw));
  } catch { return null; }
}

export function subscribeIntegrationOAuth(
  onSignal: (signal: IntegrationOAuthSignal) => void,
  options: { host: OAuthListenerHost; origin: string; BroadcastChannel?: OAuthPopupPublishDeps["BroadcastChannel"]; onFocus?: () => void },
) {
  const seen = new Set<string>();
  const deliver = (value: unknown) => {
    const signal = parseIntegrationOAuthSignal(value);
    if (!signal || seen.has(signal.id)) return;
    seen.add(signal.id);
    onSignal(signal);
  };
  let refreshesAutomatically = false;
  let channel: OAuthChannel | null = null;
  const BroadcastChannel = channelConstructor(options.BroadcastChannel);
  if (BroadcastChannel) {
    try {
      const created = new BroadcastChannel(INTEGRATION_OAUTH_CHANNEL);
      created.onmessage = (event: { data?: unknown }) => deliver(event?.data);
      channel = created;
      refreshesAutomatically = true;
    } catch { channel = null; }
  }
  const onMessage = (event: HostEvent) => {
    if (event.origin !== options.origin) return;
    deliver(event.data);
  };
  const onStorage = (event: HostEvent) => {
    if (event.key !== INTEGRATION_OAUTH_STORAGE_KEY || !event.newValue) return;
    try { deliver(JSON.parse(event.newValue)); } catch { /* Ignore malformed storage. */ }
  };
  const onFocus = () => options.onFocus?.();
  try {
    options.host.addEventListener("message", onMessage);
    options.host.addEventListener("storage", onStorage);
    refreshesAutomatically = true;
  } catch { /* The page cannot listen for a completion signal. */ }
  if (options.onFocus) {
    try {
      options.host.addEventListener("focus", onFocus);
      refreshesAutomatically = true;
    } catch { /* Focus is only a backup when the completion signal cannot be delivered. */ }
  }
  return {
    refreshesAutomatically,
    stop() {
      try { channel?.close(); } catch { /* Already closed. */ }
      try { options.host.removeEventListener("message", onMessage); } catch { /* Host already gone. */ }
      try { options.host.removeEventListener("storage", onStorage); } catch { /* Host already gone. */ }
      try { if (options.onFocus) options.host.removeEventListener("focus", onFocus); } catch { /* Host already gone. */ }
    },
  };
}

export function handleIntegrationOAuthReturn(
  win: {
    name: string;
    closed: boolean;
    close: () => void;
    opener: { postMessage: (message: unknown, targetOrigin: string) => void } | null;
    location?: { origin?: string };
    sessionStorage?: { getItem: (key: string) => string | null; removeItem: (key: string) => void };
  },
  params: URLSearchParams,
  provider: string,
  deps: OAuthPopupPublishDeps = {},
) {
  const outcome = readIntegrationOAuthOutcome(params, provider);
  if (!outcome) return { popup: false, closed: false, notice: null as { message?: string; error?: string } | null, signal: null as IntegrationOAuthSignal | null };
  if (!isIntegrationOAuthPopup(win)) return { popup: false, closed: false, notice: integrationOAuthStatus(outcome), signal: null };
  const signal = createIntegrationOAuthSignal(outcome, deps.now?.() ?? Date.now());
  publishIntegrationOAuthSignal(signal, { opener: win.opener, origin: deps.origin ?? win.location?.origin, BroadcastChannel: deps.BroadcastChannel, storage: deps.storage });
  if (!outcome.connectionError) closeIntegrationOAuthPopup(win);
  if (win.closed) return { popup: true, closed: true, notice: null, signal };
  try { if (win.name === INTEGRATION_OAUTH_POPUP) win.name = ""; } catch { /* Keep the completion message visible if the name cannot change. */ }
  try { win.sessionStorage?.removeItem(INTEGRATION_OAUTH_POPUP_FLAG); } catch { /* The query string is removed by the caller. */ }
  if (outcome.connectionError) return { popup: true, closed: false, notice: { error: `${outcome.connectionError} You can close this tab.` }, signal };
  return { popup: true, closed: false, notice: { message: OAUTH_POPUP_DONE }, signal };
}
