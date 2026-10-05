import { CATEGORY_LABELS, FORECAST_CATEGORIES, type ForecastCategory } from "../revenue/forecast-model";
import { RevenueError, stableId } from "../revenue/security";
import { HUBSPOT_PROPERTY_FIELDS, type HubspotPropertyField, type HubspotPropertyMapping } from "../revenue/types";

export const HUBSPOT_PROPERTY_LIMIT = 65000;
export const HUBSPOT_FORECAST_PROPERTY = "hs_manual_forecast_category";
const PROPERTY_NAME = /^[a-z][a-z0-9_]{0,99}$/;
const BLOCKED: Record<"deal" | "contact", Set<string>> = {
  deal: new Set(["dealname", "dealstage", "pipeline", "amount", "deal_currency_code", "closedate", "hs_is_closed", "hs_is_closed_won", "hubspot_owner_id", "hs_object_id"]),
  contact: new Set(["email", "firstname", "lastname", "hubspot_owner_id", "hs_object_id"]),
};
const HUBSPOT_FORECAST_VALUES: Record<ForecastCategory, string> = { pipeline: "PIPELINE", best_case: "BEST_CASE", commit: "COMMIT", omitted: "OMIT" };

export function clipHubspotText(value: string) {
  return value.replace(/\u0000/g, "").trim().slice(0, HUBSPOT_PROPERTY_LIMIT);
}

/** Admin-supplied mappings. Forecast category is a deal field. Imported identity fields stay read-only. */
export function parsePropertyMappings(value: unknown): HubspotPropertyMapping[] {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > 8) throw new RevenueError("Map at most eight HubSpot properties.");
  const seen = new Set<string>();
  const mappings: HubspotPropertyMapping[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") throw new RevenueError("Each mapping needs a coaching field, a deal or contact, and a HubSpot property.");
    const source = (item as { source?: unknown }).source;
    const object = (item as { object?: unknown }).object;
    const property = typeof (item as { property?: unknown }).property === "string" ? (item as { property: string }).property.trim() : "";
    if (!HUBSPOT_PROPERTY_FIELDS.includes(source as HubspotPropertyField)) throw new RevenueError("Choose a coaching summary, score, next steps, or forecast category.");
    if (object !== "deal" && object !== "contact") throw new RevenueError("Map HubSpot properties to a deal or contact.");
    if (source === "forecastCategory" && object !== "deal") throw new RevenueError("Forecast category maps to a deal property.");
    if (!PROPERTY_NAME.test(property)) throw new RevenueError("Use the HubSpot internal property name: lowercase letters, numbers, and underscores.");
    if (BLOCKED[object].has(property)) throw new RevenueError(`Choose a coaching property. ${property} is imported from HubSpot and will not be overwritten.`);
    const propertyKey = `${object}:${property}`;
    const sourceKey = `${object}:${source}`;
    if (seen.has(propertyKey) || seen.has(sourceKey)) throw new RevenueError("Each coaching field and HubSpot property can be mapped once per record type.");
    seen.add(propertyKey); seen.add(sourceKey);
    mappings.push({ source: source as HubspotPropertyField, object, property });
  }
  return mappings;
}

export function readPropertyMappings(value: unknown): HubspotPropertyMapping[] {
  try { return parsePropertyMappings(value); } catch { return []; }
}

export function forecastPropertyValue(property: string, category: ForecastCategory) {
  return property === HUBSPOT_FORECAST_PROPERTY ? HUBSPOT_FORECAST_VALUES[category] : CATEGORY_LABELS[category];
}

export function buildHubspotProperties(input: {
  mappings: HubspotPropertyMapping[]; object: "deal" | "contact"; summary?: string; score?: number | null; nextSteps?: string; forecastCategory?: ForecastCategory | null;
}) {
  const properties: Record<string, string> = {};
  for (const mapping of input.mappings) {
    if (mapping.object !== input.object) continue;
    let value = "";
    if (mapping.source === "summary") value = clipHubspotText(input.summary || "");
    else if (mapping.source === "score" && typeof input.score === "number" && Number.isInteger(input.score) && input.score >= 0 && input.score <= 10) value = String(input.score);
    else if (mapping.source === "nextSteps") value = clipHubspotText(input.nextSteps || "");
    else if (mapping.source === "forecastCategory" && input.object === "deal" && input.forecastCategory && FORECAST_CATEGORIES.includes(input.forecastCategory)) value = forecastPropertyValue(mapping.property, input.forecastCategory);
    if (value) properties[mapping.property] = value;
  }
  return canonicalProperties(properties);
}

export function canonicalProperties(properties: Record<string, string>) {
  const entries = Object.entries(properties).filter(([, value]) => value !== "").sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
  const normalized = Object.fromEntries(entries);
  return { properties: normalized, hash: stableId("hubspot-property-payload", JSON.stringify(normalized)) };
}
