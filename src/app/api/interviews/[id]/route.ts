import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/interviews/:id — detail + code snapshots; participants only. */
export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const { id } = await params;

    const interview = await db.interview.findUnique({
      where: { id },
      include: {
        room: { select: { id: true, name: true, joinCode: true, status: true } },
        problem: { select: { id: true, title: true, difficulty: true } },
        interviewer: { select: { id: true, name: true, email: true } },
        candidate: { select: { id: true, name: true, email: true } },
        snapshots: {
          orderBy: { takenAt: "asc" },
          select: {
            id: true,
            userId: true,
            user: { select: { name: true } },
            code: true,
            language: true,
            takenAt: true,
          },
        },
      },
    });

    if (
      !interview ||
      (interview.interviewerId !== user.id && interview.candidateId !== user.id)
    ) {
      // 404 either way — don't reveal other people's interviews.
      return NextResponse.json({ error: "Interview not found." }, { status: 404 });
    }

    return NextResponse.json({ interview }, { status: 200 });
  } catch (error) {
    console.error("[interviews:GET :id]", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
