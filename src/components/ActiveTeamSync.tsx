"use client";

import { useEffect, useRef } from "react";
import { useOrganization, useOrganizationList, useUser } from "@clerk/nextjs";
import { apiPath } from "@/lib/utils";

/** Attach the signed-in user to their team and make it the active session team. */
export default function ActiveTeamSync() {
  const { isSignedIn } = useUser();
  const { organization, isLoaded: orgLoaded } = useOrganization();
  const { isLoaded, setActive } = useOrganizationList();
  const syncedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!isSignedIn || !isLoaded || !orgLoaded) return;
    if (organization?.id) {
      syncedFor.current = organization.id;
      return;
    }
    if (syncedFor.current) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(apiPath("/api/team"));
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const teamId = data.team?.id as string | undefined;
        if (!teamId || cancelled) return;
        syncedFor.current = teamId;
        await setActive?.({ organization: teamId });
      } catch {
        syncedFor.current = null;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isSignedIn, isLoaded, orgLoaded, organization?.id, setActive]);

  return null;
}
