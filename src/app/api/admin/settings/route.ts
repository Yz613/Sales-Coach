import { NextResponse } from "next/server";
import { getAllSettings, setSetting } from "@/lib/db/service";

export async function GET() {
  try {
    const settings = getAllSettings();
    // Mask key for safety
    const maskedKey = settings["gemini_api_key"]
      ? `${settings["gemini_api_key"].slice(0, 6)}••••••••${settings["gemini_api_key"].slice(-4)}`
      : "";

    return NextResponse.json({
      hasKey: Boolean(settings["gemini_api_key"] || process.env.GEMINI_API_KEY),
      maskedKey,
      activeModel: settings["active_model"] || "gemini-2.5-flash",
      cloudflareAccountId: settings["cloudflare_account_id"] || "",
      cloudflareDatabaseId: settings["cloudflare_database_id"] || "",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (body.geminiApiKey !== undefined) {
      if (body.geminiApiKey.trim().length > 0) {
        setSetting("gemini_api_key", body.geminiApiKey.trim());
      }
    }

    if (body.activeModel !== undefined) {
      setSetting("active_model", body.activeModel);
    }

    if (body.cloudflareAccountId !== undefined) {
      setSetting("cloudflare_account_id", body.cloudflareAccountId);
    }

    if (body.cloudflareDatabaseId !== undefined) {
      setSetting("cloudflare_database_id", body.cloudflareDatabaseId);
    }

    return NextResponse.json({ success: true, message: "Settings saved successfully." });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
