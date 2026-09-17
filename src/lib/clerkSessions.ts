export const CLERK_BAPI_ORIGIN = "https://api.clerk.com";
export const LEAKED_HANDSHAKE_SESSION_ID = "sess_3JQHi8lfG3d9Uc4ZzTGmX5KCagW";
export const LEAKED_HANDSHAKE_USER_ID = "user_3JQHi66SmgJaaDJoUSnyHNxMBmd";
export const LEAKED_HANDSHAKE_REVOKED_SETTING = "clerk:leaked_handshake_revoked";

export type ClerkSessionRecord = {
  id?: string;
  object?: string;
  status?: string;
  user_id?: string;
  expire_at?: number;
};

export function clerkSessionRevokeUrl(sessionId: string): string {
  return `${CLERK_BAPI_ORIGIN}/v1/sessions/${encodeURIComponent(sessionId)}/revoke`;
}

export function clerkUserSessionsUrl(userId: string, status = "active"): string {
  const params = new URLSearchParams({ user_id: userId, status });
  return `${CLERK_BAPI_ORIGIN}/v1/sessions?${params}`;
}

export function parseClerkSessionList(payload: unknown): ClerkSessionRecord[] {
  if (Array.isArray(payload)) return payload as ClerkSessionRecord[];
  if (payload && typeof payload === "object" && Array.isArray((payload as { data?: unknown }).data)) {
    return (payload as { data: ClerkSessionRecord[] }).data;
  }
  return [];
}

export async function revokeClerkSession(
  secretKey: string,
  sessionId: string
): Promise<{ id: string; status: string | null; already: boolean }> {
  const res = await fetch(clerkSessionRevokeUrl(sessionId), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
  });
  const json = (await res.json().catch(() => ({}))) as ClerkSessionRecord & {
    errors?: { code?: string; message?: string }[];
  };
  if (res.status === 404 || json.errors?.some((err) => err.code === "resource_not_found")) {
    return { id: sessionId, status: "missing", already: true };
  }
  if (!res.ok) {
    throw new Error(json.errors?.[0]?.message || `Clerk rejected session revoke (${res.status}).`);
  }
  return {
    id: json.id || sessionId,
    status: json.status || "revoked",
    already: json.status === "revoked" || json.status === "ended",
  };
}

export async function listClerkUserSessions(
  secretKey: string,
  userId: string
): Promise<ClerkSessionRecord[]> {
  const res = await fetch(clerkUserSessionsUrl(userId), {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  const json = await res.json().catch(() => []);
  if (!res.ok) {
    const message =
      json && typeof json === "object" && Array.isArray((json as { errors?: { message?: string }[] }).errors)
        ? (json as { errors: { message?: string }[] }).errors[0]?.message
        : null;
    throw new Error(message || `Clerk rejected session list (${res.status}).`);
  }
  return parseClerkSessionList(json);
}

export async function revokeLeakedHandshakeSessions(secretKey: string): Promise<{
  revoked: string[];
  already: string[];
}> {
  const ids = new Set<string>([LEAKED_HANDSHAKE_SESSION_ID]);
  try {
    for (const session of await listClerkUserSessions(secretKey, LEAKED_HANDSHAKE_USER_ID)) {
      if (session.id) ids.add(session.id);
    }
  } catch {
    // Still revoke the pasted session even if listing other sessions fails.
  }

  const revoked: string[] = [];
  const already: string[] = [];
  for (const id of ids) {
    const result = await revokeClerkSession(secretKey, id);
    if (result.already) already.push(result.id);
    else revoked.push(result.id);
  }
  return { revoked, already };
}
