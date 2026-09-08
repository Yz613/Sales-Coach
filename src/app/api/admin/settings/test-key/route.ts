import { NextResponse } from "next/server";
import { getSetting } from "@/lib/db/service";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const apiKey = body.apiKey || (await getSetting("gemini_api_key")) || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ success: false, error: "No Gemini API key provided or found." }, { status: 400 });
    }

    // Ping Gemini API with a test query
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "Respond with the single word 'OK'." }] }]
      })
    });

    const data = await res.json();
    if (!res.ok || data.error) {
      return NextResponse.json({
        success: false,
        error: data.error?.message || "Invalid API key or network error."
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: "API Key verified successfully with Google Gemini!",
      model: "gemini-2.5-flash"
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
