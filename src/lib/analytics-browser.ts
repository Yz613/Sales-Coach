import posthog from "posthog-js";
import {
  FORM_SUBMITTED_EVENT,
  SIGNED_IN_EVENT,
  formLabel,
  identityPlan,
  isSameOriginMutation,
  pagePathname,
  personFields,
  planFormSuccess,
  stableAccountId,
  submissionSucceeded,
} from "@/lib/analytics-policy";
import { POSTHOG_PROJECT_TOKEN, productAnalyticsInitOptions } from "@/lib/analytics-public";

const ACCOUNT_STORAGE_KEY = "rq_analytics_account";
const FETCH_PATCH = "__rqAnalyticsFetch";

let started = false;
let knownAccountId: string | null = null;

type FormAttempt = {
  id: number;
  form: HTMLFormElement;
  sawRequest: boolean;
};

let pending: FormAttempt | null = null;
let nextAttempt = 1;
let formTrackingInstalled = false;
let inputMaskInstalled = false;

export function startProductAnalytics(): void {
  if (started || typeof window === "undefined") return;
  if (!/^phc_[A-Za-z0-9]+$/.test(POSTHOG_PROJECT_TOKEN)) return;
  started = true;
  posthog.init(POSTHOG_PROJECT_TOKEN, productAnalyticsInitOptions());
}

function analyticsStorage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function readStoredAccount(): string | null {
  try {
    return stableAccountId(analyticsStorage()?.getItem(ACCOUNT_STORAGE_KEY));
  } catch {
    return null;
  }
}

function writeStoredAccount(id: string | null): void {
  try {
    const storage = analyticsStorage();
    if (!storage) return;
    if (id) storage.setItem(ACCOUNT_STORAGE_KEY, id);
    else storage.removeItem(ACCOUNT_STORAGE_KEY);
  } catch {
    // Storage can be blocked. Identity still follows the analytics cookie.
  }
}

/** Link a signed-in account without rotating the anonymous id or the session. */
export function syncAccountAnalytics(accountId: string | null | undefined): void {
  if (!posthog.__loaded) return;
  const nextAccount = stableAccountId(accountId);
  knownAccountId = nextAccount;
  const plan = identityPlan({
    accountId: nextAccount,
    distinctId: posthog.get_distinct_id(),
    isIdentified: posthog._isIdentified(),
    storedAccountId: readStoredAccount(),
  });
  try {
    if (plan.action === "identify" && nextAccount) {
      // $set_once keeps an earlier form email_source. Reset is not called here.
      posthog.identify(nextAccount, undefined, personFields("sign_in"));
      if (plan.captureSignedIn) posthog.capture(SIGNED_IN_EVENT, personFields("sign_in"));
    } else if (plan.action === "reset") {
      posthog.reset();
    }
  } catch {
    // Analytics must not break navigation or sign-in.
  }
  writeStoredAccount(plan.storedAccountId);
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function requestMethod(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) return init.method.toUpperCase();
  if (typeof Request !== "undefined" && input instanceof Request) return input.method.toUpperCase();
  return "GET";
}

function emailFromForm(form: HTMLFormElement): string | null {
  if (form.dataset.analyticsContact !== "email") return null;
  const field = form.querySelector("input[type='email']");
  if (!(field instanceof HTMLInputElement)) return null;
  return field.value;
}

async function captureFormSuccess(form: HTMLFormElement): Promise<void> {
  if (!posthog.__loaded) return;
  const emailSource = form.dataset.analyticsEmailSource?.trim() || null;
  const planned = await planFormSuccess({
    formId: formLabel({
      analyticsForm: form.dataset.analyticsForm,
      id: form.id,
      name: form.getAttribute("name") || "",
    }),
    pagePath: pagePathname(window.location.pathname),
    emailSource,
    email: emailSource ? emailFromForm(form) : null,
    accountId: knownAccountId,
  });
  try {
    if (planned.contactId && planned.person) posthog.identify(planned.contactId, planned.person);
    posthog.capture(FORM_SUBMITTED_EVENT, planned.properties);
  } catch {
    // A blocked client should still leave the form usable.
  }
}

function armForm(form: HTMLFormElement): FormAttempt {
  const attempt: FormAttempt = { id: nextAttempt++, form, sawRequest: false };
  pending = attempt;
  return attempt;
}

/** Clicks are autocaptured. This records a form only after it succeeds. */
export function installFormTracking(): void {
  if (formTrackingInstalled || typeof window === "undefined") return;
  formTrackingInstalled = true;

  document.addEventListener(
    "submit",
    (event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      if (form.dataset.analyticsForm === "off") return;
      armForm(form);
    },
    true
  );

  document.addEventListener("submit", (event) => {
    const attempt = pending;
    const form = event.target;
    if (!attempt || form !== attempt.form) return;
    if (!event.defaultPrevented) {
      pending = null;
      void captureFormSuccess(attempt.form);
      return;
    }
    window.setTimeout(() => {
      if (pending === attempt && !attempt.sawRequest) pending = null;
    }, 1500);
  });

  const original = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const attempt = pending;
    const relevant = Boolean(
      attempt && isSameOriginMutation(requestUrl(input), requestMethod(input, init), window.location.origin)
    );
    if (relevant && attempt) attempt.sawRequest = true;
    const response = await original(input, init);
    if (relevant && attempt && pending?.id === attempt.id) {
      pending = null;
      let body: unknown = null;
      try {
        body = await response.clone().json();
      } catch {
        body = null;
      }
      if (submissionSucceeded(response.status, body)) void captureFormSuccess(attempt.form);
    }
    return response;
  };
  (window as unknown as Record<string, boolean>)[FETCH_PATCH] = true;
}

function maskControl(element: Element): void {
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
    element.classList.add("ph-no-capture");
    element.setAttribute("data-ph-no-capture", "true");
    return;
  }
  if (!(element instanceof HTMLInputElement)) return;
  const type = (element.type || "text").toLowerCase();
  if (type === "submit" || type === "button" || type === "checkbox" || type === "radio" || type === "reset" || type === "range") {
    return;
  }
  element.classList.add("ph-no-capture");
  element.setAttribute("data-ph-no-capture", "true");
}

function maskTree(root: ParentNode): void {
  if (root instanceof Element) maskControl(root);
  root.querySelectorAll("input, textarea, select").forEach(maskControl);
}

/** Keep typed input out of click events, including fields added after load. */
export function installInputMask(): void {
  if (inputMaskInstalled || typeof document === "undefined") return;
  inputMaskInstalled = true;
  maskTree(document);
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      record.addedNodes.forEach((node) => {
        if (node instanceof Element) maskTree(node);
      });
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}
