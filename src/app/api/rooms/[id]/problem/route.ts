import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { emitToRoom } from "@/lib/realtime-emit";
import { recordCodeEvent } from "@/lib/replay/record";
import { notifyUsers } from "@/lib/notify";

type RouteContext = { params: Promise<{ id: string }> };

const assignSchema = z.object({
  problemId: z.string().cuid().nullable(),
});

/** PATCH /api/rooms/:id/problem — the room host assigns (or clears) the problem. */
export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const { id } = await params;

    const room = await db.room.findUnique({
      where: { id },
      select: { id: true, name: true, hostId: true, status: true, problemId: true },
    });
    if (!room || room.status !== "ACTIVE") {
      return NextResponse.json({ error: "Room not found." }, { status: 404 });
    }
    if (room.hostId !== user.id) {
      return NextResponse.json(
        { error: "Only the room host can change the problem." },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = assignSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid problem." }, { status: 400 });
    }
    const { problemId } = parsed.data;

    let problem = null;
    if (problemId) {
      problem = await db.problem.findUnique({
        where: { id: problemId },
        select: { id: true, slug: true, title: true, difficulty: true },
      });
      if (!problem) {
        return NextResponse.json(
          { error: "Selected problem no longer exists." },
          { status: 400 }
        );
      }
    }

    const updated = await db.room.update({
      where: { id },
      data: { problemId: problemId ?? null },
      select: { id: true, problemId: true },
    });

    // Live update + timeline record: everyone sees the new problem instantly.
    emitToRoom(id, "room:update", {
      kind: "problem-changed",
      problem,
      by: user.name,
    });
    recordCodeEvent(id, "problem", user.id, {
      title: problem?.title ?? null,
      by: user.name,
    });

    // Phase 10: notify everyone else in the room about the new problem.
    const memberIds = (
      await db.roomMember.findMany({
        where: { roomId: id, userId: { not: user.id } },
        select: { userId: true },
      })
    ).map((m) => m.userId);
    void notifyUsers(memberIds, {
      type: "PROBLEM",
      title: problem ? `New problem: ${problem.title}` : "Problem cleared",
      body: room.name,
      roomId: id,
      actorName: user.name,
    });

    return NextResponse.json({ room: updated, problem }, { status: 200 });
  } catch (error) {
    console.error("[problem:PATCH]", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}

/** GET /api/rooms/:id/problem — current problem (members only). */
export async function GET(_request: Request, { params }: RouteContext) {
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

    const room = await db.room.findUnique({
      where: { id },
      select: { problem: true },
    });
    if (!room) {
      return NextResponse.json({ error: "Room not found." }, { status: 404 });
    }

    return NextResponse.json({ problem: room.problem }, { status: 200 });
  } catch (error) {
    console.error("[problem:GET]", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
