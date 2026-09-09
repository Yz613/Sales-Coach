import { stripAppBasePath, toAppPath } from "@/lib/public-path";

/** Finish choosing a team before the session is treated as signed in. */
export function pendingTeamSelectionPath(input: {
  sessionStatus?: string | null;
  publicPath: string;
}): string | null {
  if (input.sessionStatus !== "pending") return null;

  const normalized = stripAppBasePath(input.publicPath);
  if (normalized === "/select-organization" || normalized.startsWith("/select-organization/")) {
    return null;
  }

  return toAppPath("/select-organization");
}
