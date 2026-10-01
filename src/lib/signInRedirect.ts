import { APP_BASE_PATH, toAppPath } from "./public-path";

/** SignIn does not render a form for an existing session; route it explicitly. */
export function signInDestination({
  isLoaded = true,
  sessionStatus,
  currentTaskKey,
}: {
  isLoaded?: boolean;
  sessionStatus?: string | null;
  currentTaskKey?: string | null;
}): string | null {
  if (!isLoaded) return null;
  if (sessionStatus === "active") return APP_BASE_PATH;
  if (sessionStatus === "pending" && currentTaskKey === "choose-organization") {
    return toAppPath("/select-organization");
  }
  return null;
}
