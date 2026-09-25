/** Clerk uses 0 for no membership cap. Pending invites count toward the cap. */
export const UNLIMITED_TEAM_SEATS = 0;

/**
 * Highest membership limit Clerk allows without the B2B Authentication add-on.
 * The instance default is 5, which is what produces
 * "limit of 5 organization memberships, including outstanding invitations."
 */
export const CLERK_INCLUDED_SEAT_CAP = 20;

export function seatLimitNeedsRaise(current: number | null | undefined): boolean {
  return current !== UNLIMITED_TEAM_SEATS;
}

/**
 * Lift a Clerk membership cap to unlimited. If the plan rejects that, use the
 * included 20-seat ceiling instead of leaving the default of 5 in place.
 */
export async function applySeatLimit(
  current: number | null | undefined,
  update: (limit: number) => Promise<void>
): Promise<void> {
  if (!seatLimitNeedsRaise(current)) return;
  try {
    await update(UNLIMITED_TEAM_SEATS);
  } catch (err) {
    if ((current ?? 0) >= CLERK_INCLUDED_SEAT_CAP) throw err;
    await update(CLERK_INCLUDED_SEAT_CAP);
  }
}

type SeatOrg = { id: string; maxAllowedMemberships: number };

type SeatClerk = {
  instance: {
    getOrganizationSettings(): Promise<{ maxAllowedMemberships: number }>;
    updateOrganizationSettings(params: { maxAllowedMemberships: number }): Promise<unknown>;
  };
  organizations: {
    getOrganization(params: { organizationId: string }): Promise<SeatOrg>;
    getOrganizationList(params?: {
      limit?: number;
      offset?: number;
    }): Promise<{ data: SeatOrg[] }>;
    updateOrganization(
      organizationId: string,
      params: { maxAllowedMemberships: number }
    ): Promise<unknown>;
  };
};

let raised: Promise<void> | null = null;

/** Raise the instance default, this team, and any other teams still on the default cap. */
export function ensureTeamSeatLimits(clerk: SeatClerk, organizationId?: string): Promise<void> {
  const run = raiseTeamSeatLimits(clerk, organizationId);
  if (!raised) {
    raised = run.catch((err) => {
      raised = null;
      throw err;
    });
    return raised;
  }
  return organizationId ? raised.then(() => raiseOrganizationSeatLimit(clerk, organizationId)) : raised;
}

export function resetTeamSeatLimitCache(): void {
  raised = null;
}

async function raiseOrganizationSeatLimit(clerk: SeatClerk, organizationId: string): Promise<void> {
  const org = await clerk.organizations.getOrganization({ organizationId });
  await applySeatLimit(org.maxAllowedMemberships, async (limit) => {
    await clerk.organizations.updateOrganization(org.id, { maxAllowedMemberships: limit });
  });
}

async function raiseTeamSeatLimits(clerk: SeatClerk, organizationId?: string): Promise<void> {
  const settings = await clerk.instance.getOrganizationSettings();
  await applySeatLimit(settings.maxAllowedMemberships, async (limit) => {
    await clerk.instance.updateOrganizationSettings({ maxAllowedMemberships: limit });
  });

  if (organizationId) await raiseOrganizationSeatLimit(clerk, organizationId);

  let offset = 0;
  for (;;) {
    const page = await clerk.organizations.getOrganizationList({ limit: 100, offset });
    for (const org of page.data) {
      if (org.id === organizationId) continue;
      try {
        await applySeatLimit(org.maxAllowedMemberships, async (limit) => {
          await clerk.organizations.updateOrganization(org.id, { maxAllowedMemberships: limit });
        });
      } catch (err) {
        console.warn(`Could not raise seat limit for ${org.id}:`, err);
      }
    }
    if (page.data.length < 100) break;
    offset += page.data.length;
  }
}
