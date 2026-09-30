import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";

/** GET /api/problems — the seeded problem bank (any signed-in user). */
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const problems = await db.problem.findMany({
      select: { id: true, slug: true, title: true, difficulty: true },
    });

    const order: Record<string, number> = { EASY: 0, MEDIUM: 1, HARD: 2 };
    problems.sort(
      (a, b) =>
        (order[a.difficulty] ?? 3) - (order[b.difficulty] ?? 3) ||
        a.title.localeCompare(b.title)
    );

    return NextResponse.json({ problems }, { status: 200 });
  } catch (error) {
    console.error("[problems:GET]", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
