import { requireWorkspace } from "../workspace";
import { ensureRevenueSchema } from "../db";
import { getCallById, listRepIdentities } from "../db/service";
import { canViewCall } from "../call-access";
import { toCallViewer } from "../viewer-calls";
import type { AuthUser } from "../auth";
import { RevenueError } from "./security";

export async function requireRevenueAdmin(): Promise<AuthUser> {
  const auth = await requireWorkspace();
  if (!auth.isAdmin) throw new RevenueError("Only workspace admins can manage this feature.", 403);
  await ensureRevenueSchema();
  return auth;
}

export async function accessibleCall(auth: AuthUser, callId: string) {
  const call = await getCallById(callId);
  if (!call || !canViewCall(call, await listRepIdentities(), toCallViewer(auth))) {
    throw new RevenueError("Call not found.", 404);
  }
  return call;
}

export async function requireConversation(callId: string) {
  const auth = await requireWorkspace();
  await ensureRevenueSchema();
  return { auth, call: await accessibleCall(auth, callId) };
}
