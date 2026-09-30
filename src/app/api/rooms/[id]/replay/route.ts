import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";

type RouteContext = { params: Promise<{ id: string }> };

const MAX_EVENTS = 3000;

/**
 * GET /api/rooms/:id/replay — the room's full timeline (members only).
 * Events come oldest-first; the player folds them into playable moments.
 */
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
      select: { id: true, name: true, status: true },
    });
    if (!room) {
      return NextResponse.json({ error: "Room not found." }, { status: 404 });
    }

    const events = await db.codeEvent.findMany({
      where: { roomId: id },
      orderBy: { createdAt: "asc" },
      take: MAX_EVENTS,
      select: {
        id: true,
        type: true,
        userId: true,
        payload: true,
        createdAt: true,
      },
    });

    // The API is member-visible but names are displayed in the player: resolve
    // them in one query and inline into payloads.
    const userIds = [...new Set(events.map((e) => e.userId))];
    const users = await db.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true },
    });
    const nameById = new Map(users.map((u) => [u.id, u.name]));

    return NextResponse.json(
      {
        room: { id: room.id, name: room.name, status: room.status },
        events: events.map((e) => ({
          id: e.id,
          type: e.type,
          userId: e.userId,
          userName: nameById.get(e.userId) ?? "Someone",
          at: e.createdAt.toISOString(),
          payload: e.payload,
        })),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[replay:GET]", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
