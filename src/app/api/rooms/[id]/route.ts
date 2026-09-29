import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/rooms/:id — room detail; visible only to its members. */
export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const { id } = await params;

    const membership = await db.roomMember.findUnique({
      where: { roomId_userId: { roomId: id, userId: user.id } },
    });
    if (!membership) {
      // 404 (not 403) — don't reveal rooms the caller isn't in.
      return NextResponse.json({ error: "Room not found." }, { status: 404 });
    }

    const room = await db.room.findUnique({
      where: { id },
      include: {
        problem: { select: { id: true, title: true, difficulty: true } },
        members: {
          orderBy: { joinedAt: "asc" },
          select: {
            id: true,
            role: true,
            joinedAt: true,
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });
    if (!room) {
      return NextResponse.json({ error: "Room not found." }, { status: 404 });
    }

    return NextResponse.json(
      { room, myRole: membership.role },
      { status: 200 }
    );
  } catch (error) {
    console.error("[rooms:GET :id]", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
