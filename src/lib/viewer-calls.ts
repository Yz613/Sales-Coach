import type { AuthUser } from "@/lib/auth";
import { getServerAuth } from "@/lib/auth";
import {
  canViewCall,
  filterCallsForViewer,
  isOwnRep,
  type CallViewer,
  type RepIdentity,
} from "@/lib/call-access";
import { getAllCalls, getCallById, getOrCreateRep, listRepIdentities } from "@/lib/db/service";
import type { Call } from "@/types";

export function toCallViewer(auth: AuthUser): CallViewer {
  return {
    canViewAllCalls: auth.canViewAllCalls,
    email: auth.email,
    name: auth.name,
  };
}

export async function getVisibleCalls(): Promise<{
  auth: AuthUser;
  viewer: CallViewer;
  reps: RepIdentity[];
  calls: Call[];
}> {
  const auth = await getServerAuth();
  const viewer = toCallViewer(auth);
  const reps = await listRepIdentities();
  const calls = filterCallsForViewer(await getAllCalls(), reps, viewer);
  return { auth, viewer, reps, calls };
}

export async function getVisibleCallById(id: string): Promise<{
  auth: AuthUser;
  call: Call | null;
}> {
  const auth = await getServerAuth();
  const call = await getCallById(id);
  if (!call) return { auth, call: null };
  const reps = await listRepIdentities();
  if (!canViewCall(call, reps, toCallViewer(auth))) {
    return { auth, call: null };
  }
  return { auth, call };
}

export async function resolveUploadRepId(
  auth: AuthUser,
  requested: { repId?: string; repName?: string; repRole?: string }
): Promise<string> {
  if (auth.canViewAllCalls) {
    return getOrCreateRep(requested.repId, requested.repName, requested.repRole);
  }

  const reps = await listRepIdentities();
  const own = reps.find((rep) => isOwnRep(rep, toCallViewer(auth)));
  if (own?.id) return own.id;

  const name = auth.name || requested.repName || "You";
  return getOrCreateRep(undefined, name, requested.repRole || "Sales Rep", auth.email);
}
