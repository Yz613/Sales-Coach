/** Public site identity, hosted URLs, and published prices. */

export const SITE_URL = "https://refreshqueue.com";
export const SITE_NAME = "Sales Coach AI";
export const GITHUB_REPO_URL = "https://github.com/Yz613/Sales-Coach";
export const ENTERPRISE_EMAIL = "hello@refreshqueue.com";

/** Next route (under `basePath: /app`) for the public marketing page. */
export const MARKETING_INTERNAL_PATH = "/home";

export const SITE_TITLE = "Sales Coach AI — Executive AI Sales Coaching";
export const SITE_DESCRIPTION =
  "Pointed call coaching for B2B sales leaders. Sales Coach AI grades blocking and tackling, Sandler qualification, and pipeline progression — tuned by rep, stage, and deal.";

/**
 * Hosted is a premium sales-ops product, not a cheap seat wrapper.
 * Open source stays free. Annual billing charges 10 months (2 months free).
 */
export const PRICING = {
  starterMonthly: 499,
  starterSeats: 5,
  growthMonthly: 1499,
  growthSeats: 25,
  annualMonthsCharged: 10,
} as const;

export function annualTotal(monthly: number): number {
  return monthly * PRICING.annualMonthsCharged;
}

export function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}
