import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/rooms/:id/submissions — this room's submission history. */
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

    const submissions = await db.submission.findMany({
      where: { roomId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        userId: true,
        user: { select: { name: true } },
        verdict: true,
        passed: true,
        total: true,
        runtimeMs: true,
        language: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ submissions }, { status: 200 });
  } catch (error) {
    console.error("[submissions:GET]", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
