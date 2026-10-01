import { withWorkspaceApi } from "@/lib/workspace";
import { NextResponse } from "next/server";
import { addCoachLesson, deleteCoachLesson, getCoachLessons } from "@/lib/db/service";
import { requireWorkspace, workspaceErrorResponse } from "@/lib/workspace";

async function POSTHandler(req: Request) {
  try {
    await requireWorkspace();
    const body = await req.json();
    const text = (body.text || "").trim();
    if (!text) {
      return NextResponse.json({ error: "Lesson text is required" }, { status: 400 });
    }
    const lesson = await addCoachLesson(text, body.sourceCallId || undefined);
    return NextResponse.json({ success: true, lesson });
  } catch (err: any) {
    return workspaceErrorResponse(err);
  }
}

async function DELETEHandler(req: Request) {
  try {
    await requireWorkspace();
    const body = await req.json();
    if (!body.id) {
      return NextResponse.json({ error: "Lesson id is required" }, { status: 400 });
    }
    await deleteCoachLesson(body.id);
    const lessons = await getCoachLessons();
    return NextResponse.json({ success: true, lessons });
  } catch (err: any) {
    return workspaceErrorResponse(err);
  }
}

export const POST = withWorkspaceApi(POSTHandler, { admin: true });
export const DELETE = withWorkspaceApi(DELETEHandler, { admin: true });

export const dynamic = "force-dynamic";
