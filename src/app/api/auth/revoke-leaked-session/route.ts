import { NextResponse } from "next/server";
import { getGlobalSetting, setGlobalSetting } from "@/lib/db/service";
import {
  LEAKED_HANDSHAKE_REVOKED_SETTING,
  revokeLeakedHandshakeSessions,
} from "@/lib/clerkSessions";

export const dynamic = "force-dynamic";

async function revokeOnce() {
  const secret = (process.env.CLERK_SECRET_KEY || "").trim();
  if (!secret) {
    return NextResponse.json({ error: "CLERK_SECRET_KEY is not configured." }, { status: 503 });
  }

  const prior = await getGlobalSetting(LEAKED_HANDSHAKE_REVOKED_SETTING);
  if (prior) {
    return NextResponse.json({ revoked: true, already: true });
  }

  try {
    const result = await revokeLeakedHandshakeSessions(secret);
    await setGlobalSetting(LEAKED_HANDSHAKE_REVOKED_SETTING, new Date().toISOString());
    return NextResponse.json({
      revoked: true,
      already: false,
      sessionIds: result.revoked,
      alreadyIds: result.already,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to revoke the leaked session.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function GET() {
  return revokeOnce();
}

export async function POST() {
  return revokeOnce();
}
