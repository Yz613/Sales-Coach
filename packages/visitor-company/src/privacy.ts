import { normalizeCountry } from "./ip.js";

/** EU member states, the UK, and the rest of the EEA (Iceland, Liechtenstein, Norway). */
export const EU_UK_EEA_COUNTRIES = [
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
  "IS",
  "LI",
  "NO",
  "GB",
] as const;

const DEFAULT_PRIVACY = new Set<string>(EU_UK_EEA_COUNTRIES);

export function isPrivacyRegion(input: {
  country?: string | null;
  isEUCountry?: boolean;
  countries?: readonly string[];
}): boolean {
  if (input.isEUCountry === true) return true;
  const code = normalizeCountry(input.country);
  if (!code) return false;
  if (input.countries) {
    return input.countries.some((country) => normalizeCountry(country) === code);
  }
  return DEFAULT_PRIVACY.has(code);
}
