import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { joinCodeSchema } from "@/lib/room-codes";

const joinSchema = z.object({ code: joinCodeSchema });

/** POST /api/rooms/join — join an ACTIVE room by its 6-character code. */
export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const parsed = joinSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid room code." },
        { status: 400 }
      );
    }
    const { code } = parsed.data;

    const room = await db.room.findUnique({
      where: { joinCode: code },
      include: {
        problem: { select: { id: true, title: true, difficulty: true } },
      },
    });

    if (!room || room.status !== "ACTIVE") {
      // Same message for both cases — don't leak which codes exist.
      return NextResponse.json(
        { error: "No active room found with this code." },
        { status: 404 }
      );
    }

    // Idempotent: joining a room you're already in just returns it.
    const member = await db.roomMember.upsert({
      where: { roomId_userId: { roomId: room.id, userId: user.id } },
      create: { roomId: room.id, userId: user.id, role: "MEMBER" },
      update: {},
    });

    return NextResponse.json({ room, role: member.role }, { status: 200 });
  } catch (error) {
    console.error("[rooms:join]", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
