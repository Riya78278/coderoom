import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { LANGUAGE_VALUES } from "@/lib/languages";

const patchSchema = z.object({
  code: z.string().max(100_000, "Code is too large to save."),
  language: z.enum(LANGUAGE_VALUES).optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH /api/rooms/:id/code — autosave for the shared editor (Phase 3).
 * Any member may save; Phase 4 will layer real-time broadcast on top of
 * this same persisted document.
 */
export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const { id } = await params;

    const membership = await db.roomMember.findUnique({
      where: { roomId_userId: { roomId: id, userId: user.id } },
      select: { id: true },
    });
    if (!membership) {
      return NextResponse.json({ error: "Room not found." }, { status: 404 });
    }

    const body = await request.json().catch(() => null);
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input." },
        { status: 400 }
      );
    }

    const room = await db.room.update({
      where: { id },
      data: {
        code: parsed.data.code,
        ...(parsed.data.language ? { language: parsed.data.language } : {}),
      },
      select: { id: true, language: true, updatedAt: true },
    });

    return NextResponse.json({ room }, { status: 200 });
  } catch (error) {
    console.error("[rooms:PATCH code]", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
