import { NextResponse } from "next/server";
import { addCoachLesson, deleteCoachLesson, getCoachLessons } from "@/lib/db/service";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const text = (body.text || "").trim();
    if (!text) {
      return NextResponse.json({ error: "Lesson text is required" }, { status: 400 });
    }
    const lesson = await addCoachLesson(text, body.sourceCallId || undefined);
    return NextResponse.json({ success: true, lesson });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    if (!body.id) {
      return NextResponse.json({ error: "Lesson id is required" }, { status: 400 });
    }
    await deleteCoachLesson(body.id);
    const lessons = await getCoachLessons();
    return NextResponse.json({ success: true, lessons });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
