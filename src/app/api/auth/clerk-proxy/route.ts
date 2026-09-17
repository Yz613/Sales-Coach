import { NextResponse } from "next/server";
import { clerkProxyPublicUrl, enableClerkFrontendProxy } from "@/lib/clerkProxy";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    proxyUrl: clerkProxyPublicUrl(),
    configured: Boolean(process.env.NEXT_PUBLIC_CLERK_PROXY_URL || process.env.CLERK_SECRET_KEY),
  });
}

export async function POST() {
  const secret = (process.env.CLERK_SECRET_KEY || "").trim();
  if (!secret) {
    return NextResponse.json({ error: "CLERK_SECRET_KEY is not configured." }, { status: 503 });
  }
  try {
    const result = await enableClerkFrontendProxy(secret, clerkProxyPublicUrl());
    const status = result.configured ? 200 : 502;
    return NextResponse.json(result, { status });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to enable Clerk proxy.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
