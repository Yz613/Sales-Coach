import type { PostHogConfig } from "posthog-js";
import {
  ANALYTICS_APP_HOST,
  ANALYTICS_INGEST_HOST,
  redactAnalyticsEvent,
} from "@/lib/analytics-policy";

/**
 * Public write-only project token for Refresh Queue (PostHog project 645997).
 * Safe in the browser. There is no secret API key.
 */
export const POSTHOG_PROJECT_TOKEN = "phc_mVffCXjymuk8ir9UF2n92VABboozTTEpfKWqvKkcGZGL";

/** US cloud ingest. Do not point this at the EU host. */
export const POSTHOG_API_HOST = ANALYTICS_INGEST_HOST;

export const POSTHOG_PROJECT_ID = "645997";

export function productAnalyticsInitOptions(): Partial<PostHogConfig> {
  return {
    api_host: POSTHOG_API_HOST,
    ui_host: ANALYTICS_APP_HOST,
    defaults: "2026-05-30",
    // Path covers client navigations. Search and hash cover pricing links and query changes.
    // The 2026-06-25 defaults would turn hash capture back off, so keep it explicit.
    capture_pageview: { path: true, search: true, hash: true },
    disable_capture_url_hashes: false,
    // Date defaults would mark localhost as a test person on page load. That creates a profile from browsing.
    internal_or_test_user_hostname: /^$/,
    person_profiles: "identified_only",
    disable_session_recording: true,
    disable_surveys: true,
    capture_exceptions: false,
    capture_heatmaps: false,
    autocapture: {
      dom_event_allowlist: ["click"],
      css_selector_allowlist: [
        "a",
        "button",
        "input[type='submit']",
        "input[type='button']",
        "[role='button']",
        "[role='link']",
      ],
      css_selector_ignorelist: [
        ".ph-no-autocapture",
        "[data-ph-no-autocapture]",
        ".ph-no-capture",
        "[data-ph-no-capture]",
        "input:not([type='submit']):not([type='button'])",
        "textarea",
        "select",
      ],
      element_attribute_ignorelist: ["value", "placeholder"],
      capture_copied_text: false,
    },
    session_recording: {
      maskAllInputs: true,
    },
    before_send: redactAnalyticsEvent,
  };
}
