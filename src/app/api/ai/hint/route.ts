import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { aiEnabled, chatCompletion } from "@/lib/ai/openai";
import { offlineHintFor } from "@/lib/ai/offline-hints";

const hintSchema = z.object({
  roomId: z.string().cuid(),
  question: z.string().trim().max(500).optional(),
});

/**
 * POST /api/ai/hint — an interviewer-style nudge for the room's problem,
 * grounded in the room's current code. Members only, never reveals a
 * full solution (system-prompt constrained).
 */
export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const parsed = hintSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input." }, { status: 400 });
    }
    const { roomId, question } = parsed.data;

    const membership = await db.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId: user.id } },
      select: { id: true },
    });
    if (!membership) {
      return NextResponse.json({ error: "Room not found." }, { status: 404 });
    }

    const room = await db.room.findUnique({
      where: { id: roomId },
      select: {
        code: true,
        language: true,
        problem: { select: { title: true, description: true, slug: true } },
      },
    });
    if (!room) {
      return NextResponse.json({ error: "Room not found." }, { status: 404 });
    }

    // No API key → offline "smart coach": per-problem hint ladders picked by
    // the candidate's actual code progress. Always available, zero cost.
    if (!aiEnabled()) {
      const hint = offlineHintFor(
        room.problem?.slug ?? null,
        room.code,
        room.language
      );
      return NextResponse.json({ hint, source: "offline-coach" }, { status: 200 });
    }

    const answer = await chatCompletion(
      [
        {
          role: "system",
          content:
            "You are a supportive technical interview coach. Give a SHORT hint (max 4 sentences) that nudges the candidate toward the next insight. Never write the complete solution. Reference their actual code when useful. If their approach looks correct so far, say what to think about next.",
        },
        {
          role: "user",
          content: [
            `Problem: ${room.problem?.title ?? "Free collaboration (no problem selected)"}`,
            room.problem?.description ? `Description: ${room.problem.description.slice(0, 1500)}` : "",
            `Their current code:\n${room.code.slice(0, 4000) || "(empty)"}`,
            question ? `The candidate asks: ${question}` : "The candidate asks for a hint.",
          ]
            .filter(Boolean)
            .join("\n\n"),
        },
      ],
      { maxTokens: 250, temperature: 0.4 }
    );

    return NextResponse.json({ hint: answer }, { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.name === "AINotConfiguredError") {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error("[ai:hint]", error);
    return NextResponse.json(
      { error: "AI request failed. Please try again." },
      { status: 502 }
    );
  }
}
