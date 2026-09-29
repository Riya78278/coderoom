import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { generateJoinCode } from "@/lib/room-codes";
import { LANGUAGE_VALUES, starterCodeFor } from "@/lib/languages";

const createRoomSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Room name must be at least 3 characters.")
    .max(60, "Room name is too long."),
  language: z.enum(LANGUAGE_VALUES).default("javascript"),
  problemId: z.string().cuid().nullish(),
  visibility: z.enum(["PUBLIC", "PRIVATE"]).default("PRIVATE"),
});

/** POST /api/rooms — create a room; the creator becomes its HOST. */
export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const parsed = createRoomSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input." },
        { status: 400 }
      );
    }
    const { name, language, problemId, visibility } = parsed.data;

    let problem = null;
    if (problemId) {
      problem = await db.problem.findUnique({ where: { id: problemId } });
      if (!problem) {
        return NextResponse.json(
          { error: "Selected problem no longer exists." },
          { status: 400 }
        );
      }
    }

    // Pre-load the editor with the problem's starter code (or a generic
    // scaffold) so the first open of the room shows something to type on.
    const initialCode = starterCodeFor(problem?.slug ?? null, language);

    // joinCode is unique — retry on the rare collision (1 in ~57^6 codes).
    let room = null;
    for (let attempt = 0; attempt < 5 && !room; attempt++) {
      try {
        room = await db.room.create({
          data: {
            name,
            language,
            visibility,
            code: initialCode,
            problemId: problemId ?? null,
            joinCode: generateJoinCode(),
            hostId: user.id,
            members: { create: { userId: user.id, role: "HOST" } },
          },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          continue; // code collision — roll again
        }
        throw error;
      }
    }

    if (!room) {
      return NextResponse.json(
        { error: "Could not generate a room code. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ room }, { status: 201 });
  } catch (error) {
    console.error("[rooms:POST]", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}

/** GET /api/rooms — rooms the caller belongs to, most recently active first. */
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const memberships = await db.roomMember.findMany({
      where: { userId: user.id },
      orderBy: { room: { updatedAt: "desc" } },
      select: {
        role: true,
        room: {
          include: {
            problem: { select: { id: true, title: true, difficulty: true } },
            _count: { select: { members: true } },
          },
        },
      },
    });

    const rooms = memberships
      .map((m) => ({
        ...m.room,
        myRole: m.role,
        memberCount: m.room._count.members,
      }))
      .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));

    return NextResponse.json({ rooms }, { status: 200 });
  } catch (error) {
    console.error("[rooms:GET]", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
