export type CallViewer = {
  canViewAllCalls: boolean;
  email?: string | null;
  name?: string | null;
};

export type RepIdentity = {
  id?: string;
  email?: string | null;
  name?: string | null;
};

export function normalizeIdentity(value?: string | null): string {
  return (value || "").trim().toLowerCase();
}

/** True when this rep record belongs to the signed-in member. */
export function isOwnRep(rep: RepIdentity, viewer: CallViewer): boolean {
  const viewerEmail = normalizeIdentity(viewer.email);
  const repEmail = normalizeIdentity(rep.email);
  // viewer.email comes from the identity provider's verified primary address.
  return Boolean(viewerEmail && repEmail && viewerEmail === repEmail);
}

export function ownRepIds(reps: RepIdentity[], viewer: CallViewer): Set<string> {
  return new Set(
    reps.filter((rep) => rep.id && isOwnRep(rep, viewer)).map((rep) => rep.id as string)
  );
}

export function filterCallsForViewer<T extends { repId: string; repName?: string | null }>(
  calls: T[],
  reps: RepIdentity[],
  viewer: CallViewer
): T[] {
  if (viewer.canViewAllCalls) return calls;
  const ids = ownRepIds(reps, viewer);
  return calls.filter((call) => ids.has(call.repId));
}

export function canViewCall(
  call: { repId: string; repName?: string | null },
  reps: RepIdentity[],
  viewer: CallViewer
): boolean {
  if (viewer.canViewAllCalls) return true;
  return ownRepIds(reps, viewer).has(call.repId);
}

/** Org members never see other people's calls. */
export function resolveCanViewAllCalls(input: {
  clerkConfigured: boolean;
  userId?: string | null;
  orgRole?: string | null;
  hasOrgAdmin?: boolean;
  isAdmin: boolean;
}): boolean {
  if (!input.clerkConfigured || !input.userId) {
    return input.isAdmin;
  }
  if (input.orgRole === "org:member") return false;
  if (input.hasOrgAdmin || input.orgRole === "org:admin") {
    return true;
  }
  return false;
}
