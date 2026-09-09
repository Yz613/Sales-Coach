/** Built-in Call Stage Targets. Managers can add, rename, or create custom ones. */
export const DEFAULT_CALL_STAGES = ["Cold Call", "First Discovery", "Follow-up"] as const;

export const CUSTOM_STAGE_VALUE = "__custom__";

export function normalizeStageName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export function mergeCallStages(
  stored: string[] | null | undefined,
  fromScripts: string[] = [],
  fromCalls: string[] = []
): string[] {
  const base = stored && stored.length > 0 ? stored : [...DEFAULT_CALL_STAGES];
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of [...base, ...fromScripts, ...fromCalls]) {
    const name = normalizeStageName(String(raw || ""));
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(name);
  }

  return result;
}

export function stagesEqual(a: string, b: string): boolean {
  return normalizeStageName(a).toLowerCase() === normalizeStageName(b).toLowerCase();
}
