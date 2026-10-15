import { NextResponse } from "next/server";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET() {
  const created = Math.floor(Date.now() / 1000);

  const models = [
    {
      id: "sales-coach",
      object: "model",
      created,
      owned_by: "sales-coach",
      permission: [],
      root: "sales-coach",
      parent: null,
    },
    {
      id: "sales-coach-forecast",
      object: "model",
      created,
      owned_by: "sales-coach",
      permission: [],
      root: "sales-coach",
      parent: null,
    },
    {
      id: "sales-coach-calls",
      object: "model",
      created,
      owned_by: "sales-coach",
      permission: [],
      root: "sales-coach",
      parent: null,
    },
    {
      id: "gpt-4o",
      object: "model",
      created,
      owned_by: "sales-coach",
      permission: [],
      root: "sales-coach",
      parent: null,
    },
    {
      id: "gpt-4",
      object: "model",
      created,
      owned_by: "sales-coach",
      permission: [],
      root: "sales-coach",
      parent: null,
    },
  ];

  return NextResponse.json(
    {
      object: "list",
      data: models,
    },
    { headers: CORS_HEADERS }
  );
}

export const dynamic = "force-dynamic";
