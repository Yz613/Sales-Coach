import { NextResponse } from "next/server";
import { withWorkspaceApi } from "@/lib/workspace";
import { requireRevenueAdmin } from "@/lib/revenue/access";
import { readJson, revenueError } from "@/lib/revenue/api";
import { forecastWorkspace, submitForecast } from "@/lib/revenue/forecast";
export const GET = withWorkspaceApi(async (request: Request) => {
  try { const auth = await requireRevenueAdmin(); return NextResponse.json(await forecastWorkspace(auth, Object.fromEntries(new URL(request.url).searchParams))); }
  catch (error) { return revenueError(error); }
}, { admin: true });
export const POST = withWorkspaceApi(async (request: Request) => {
  try { const auth = await requireRevenueAdmin(); return NextResponse.json(await submitForecast(auth, await readJson(request))); }
  catch (error) { return revenueError(error); }
}, { admin: true });
export const dynamic = "force-dynamic";
