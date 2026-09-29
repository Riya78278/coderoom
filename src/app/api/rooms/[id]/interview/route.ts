import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";

type RouteContext = { params: Promise<{ id: string }> };

const startSchema = z.object({
  candidateId: z.string().cuid(),
});

const endSchema = z.object({
  rating: z.number().int().min(1).max(5).nullable().optional(),
  feedback: z.string().trim().max(2000).optional(),
});

/** POST /api/rooms/:id/interview — host starts an interview session. */
export async function POST(request: Request, { params }: RouteContext) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const { id } = await params;

    const body = await request.json().catch(() => null);
    const parsed = startSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid candidate." }, { status: 400 });
    }
    const { candidateId } = parsed.data;

    const room = await db.room.findUnique({
      where: { id },
      select: {
        id: true,
        hostId: true,
        status: true,
        problemId: true,
        members: { select: { userId: true, role: true } },
      },
    });
    if (!room || room.status !== "ACTIVE") {
      return NextResponse.json({ error: "Room not found." }, { status: 404 });
    }

    const me = room.members.find((m) => m.userId === user.id);
    if (!me || me.role !== "HOST") {
      return NextResponse.json(
        { error: "Only the room host can start an interview." },
        { status: 403 }
      );
    }

    if (candidateId === user.id) {
      return NextResponse.json(
        { error: "Pick a different member as the candidate." },
        { status: 400 }
      );
    }
    if (!room.members.some((m) => m.userId === candidateId)) {
      return NextResponse.json(
        { error: "Candidate must be a member of this room." },
        { status: 400 }
      );
    }

    const existing = await db.interview.findFirst({
      where: { roomId: id, status: "ACTIVE" },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: "An interview is already running in this room." },
        { status: 409 }
      );
    }

    const interview = await db.interview.create({
      data: {
        roomId: id,
        interviewerId: user.id,
        candidateId,
        problemId: room.problemId,
      },
    });

    return NextResponse.json({ interview }, { status: 201 });
  } catch (error) {
    console.error("[interview:POST]", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}

/** PATCH /api/rooms/:id/interview — host ends the session with feedback. */
export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const { id } = await params;

    const body = await request.json().catch(() => null);
    const parsed = endSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input." },
        { status: 400 }
      );
    }

    const interview = await db.interview.findFirst({
      where: { roomId: id, status: "ACTIVE" },
    });
    if (!interview) {
      return NextResponse.json(
        { error: "No active interview in this room." },
        { status: 404 }
      );
    }

    if (interview.interviewerId !== user.id) {
      return NextResponse.json(
        { error: "Only the interviewer can end the session." },
        { status: 403 }
      );
    }

    const room = await db.room.findUnique({
      where: { id },
      select: { code: true, language: true },
    });
    if (!room) {
      return NextResponse.json({ error: "Room not found." }, { status: 404 });
    }

    const [completed] = await db.$transaction([
      db.interview.update({
        where: { id: interview.id },
        data: {
          status: "COMPLETED",
          endedAt: new Date(),
          rating: parsed.data.rating,
          feedback: parsed.data.feedback,
        },
      }),
      // Snapshot the final shared document as the session's end state.
      db.codeSnapshot.create({
        data: {
          interviewId: interview.id,
          userId: user.id,
          code: room.code,
          language: room.language,
        },
      }),
      db.room.update({
        where: { id },
        data: { status: "COMPLETED", endedAt: new Date() },
      }),
    ]);

    return NextResponse.json({ interview: completed }, { status: 200 });
  } catch (error) {
    console.error("[interview:PATCH]", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}

/** GET /api/rooms/:id/interview — the room's active interview, if any. */
export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const user = await getSessionUser();
    if (user === null) {
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

    const interview = await db.interview.findFirst({
      where: { roomId: id, status: "ACTIVE" },
    });
    return NextResponse.json({ interview }, { status: 200 });
  } catch (error) {
    console.error("[interview:GET]", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
