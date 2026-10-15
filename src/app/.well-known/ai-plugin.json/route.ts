import { NextResponse } from "next/server";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || url.host;
  const proto = request.headers.get("x-forwarded-proto") || (url.protocol.replace(":", "") || "https");
  const origin = `${proto}://${host}`;

  const manifest = {
    schema_version: "v1",
    name_for_human: "Sales Coach",
    name_for_model: "sales_coach",
    description_for_human: "Query sales call scorecards, rep coaching insights, quota gaps, and pipeline forecasts.",
    description_for_model: "Sales Coach plugin. Query call transcripts, scorecards, coaching feedback, rep performance metrics, and pipeline forecasts directly from Sales Coach.",
    auth: {
      type: "user_http",
      authorization_type: "bearer",
    },
    api: {
      type: "openapi",
      url: `${origin}/app/api/openapi.json`,
    },
    logo_url: `${origin}/app/icon.svg`,
    contact_email: "support@refreshqueue.com",
    legal_info_url: `${origin}/app/privacy`,
  };

  return NextResponse.json(manifest, { headers: CORS_HEADERS });
}

export const dynamic = "force-dynamic";
