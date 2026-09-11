/** Display and storage helpers for optional prospect company. */

const UNKNOWN_COMPANY_RE =
  /^(unknown(\s+(co|company))?|n\/?a|none|tbd|-|enterprise prospect|company(\s+from\s+.+|\s+\d+)?)$/i;

const GENERIC_CONTACT_RE =
  /^(lead|prospect|contact|lead contact)(\s|$|\()/i;

export function normalizeProspectCompany(company?: string | null): string {
  return (company || "").trim();
}

export function hasKnownCompany(company?: string | null): boolean {
  const value = normalizeProspectCompany(company);
  if (!value) return false;
  return !UNKNOWN_COMPANY_RE.test(value);
}

export function cleanProspectName(name?: string | null): string {
  const value = (name || "").trim();
  if (!value) return "";
  if (GENERIC_CONTACT_RE.test(value)) return "";
  return value;
}

/** "Apex Logistics", "Greg Miller", or "this call" — never a fake company. */
export function callPartyLabel(input: {
  prospectCompany?: string | null;
  prospectName?: string | null;
}): string {
  const company = hasKnownCompany(input.prospectCompany)
    ? normalizeProspectCompany(input.prospectCompany)
    : "";
  const name = (input.prospectName || "").trim();
  const knownName = cleanProspectName(name) || name;
  if (company) return company;
  if (knownName) return knownName;
  return "this call";
}

/** Compact subtitle used in tables: company • name, omitting unknowns. */
export function callPartySubtitle(input: {
  prospectCompany?: string | null;
  prospectName?: string | null;
}): string {
  const company = hasKnownCompany(input.prospectCompany)
    ? normalizeProspectCompany(input.prospectCompany)
    : "";
  const name = (input.prospectName || "").trim();
  if (company && name) return `${company} • ${name}`;
  if (company) return company;
  if (name) return name;
  return "Unnamed prospect";
}

/** Sentence fragment for coaching copy: "Jane at Acme" or "Jane" or "the prospect". */
export function formatProspectContext(input: {
  prospectCompany?: string | null;
  prospectName?: string | null;
}): string {
  const company = hasKnownCompany(input.prospectCompany)
    ? normalizeProspectCompany(input.prospectCompany)
    : "";
  const name = (input.prospectName || "").trim() || "the prospect";
  if (company) return `${name} at ${company}`;
  return name;
}
