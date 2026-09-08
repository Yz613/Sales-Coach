import { NextResponse } from "next/server";
import { getAllSettings, setSetting } from "@/lib/db/service";

export async function GET() {
  try {
    const settings = await getAllSettings();
    // Mask key for safety
    const maskedKey = settings["gemini_api_key"]
      ? `${settings["gemini_api_key"].slice(0, 6)}••••••••${settings["gemini_api_key"].slice(-4)}`
      : "";

    return NextResponse.json({
      hasKey: Boolean(settings["gemini_api_key"] || process.env.GEMINI_API_KEY),
      maskedKey,
      activeModel: settings["active_model"] || "gemini-3.8-flash",
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
        await setSetting("gemini_api_key", body.geminiApiKey.trim());
      }
    }

    if (body.activeModel !== undefined) {
      await setSetting("active_model", body.activeModel);
    }

    return NextResponse.json({ success: true, message: "Settings saved successfully." });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
