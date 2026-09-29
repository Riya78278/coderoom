import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";

/** GET /api/interviews — interviews where I was interviewer or candidate. */
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const interviews = await db.interview.findMany({
      where: {
        OR: [{ interviewerId: user.id }, { candidateId: user.id }],
      },
      orderBy: { startedAt: "desc" },
      take: 100,
      include: {
        room: { select: { id: true, name: true, joinCode: true, status: true } },
        problem: { select: { id: true, title: true, difficulty: true } },
        interviewer: { select: { id: true, name: true } },
        candidate: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ interviews }, { status: 200 });
  } catch (error) {
    console.error("[interviews:GET]", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
