import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { aiEnabled, chatCompletion } from "@/lib/ai/openai";

type RouteContext = { params: Promise<{ id: string }> };

const feedbackSchema = z.object({});

/**
 * POST /api/ai/feedback/:interviewId — generate a post-session review
 * (communication, approach, complexity, code quality) from the session's
 * final code + snapshots. Interviewer only. Saves to Interview.aiFeedback.
 */
export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const { id } = await params;

    const interview = await db.interview.findUnique({
      where: { id },
      select: {
        id: true,
        interviewerId: true,
        status: true,
        rating: true,
        problem: { select: { title: true, description: true } },
        snapshots: {
          orderBy: { takenAt: "asc" },
          select: { code: true, language: true, takenAt: true },
        },
      },
    });
    if (!interview || interview.interviewerId !== user.id) {
      return NextResponse.json({ error: "Interview not found." }, { status: 404 });
    }

    // Availability after authorization (don't leak config to strangers).
    if (!aiEnabled()) {
      return NextResponse.json(
        { error: "AI is not configured on this server (missing OPENAI_API_KEY)." },
        { status: 503 }
      );
    }

    const finalCode =
      interview.snapshots.at(-1)?.code ?? "(no snapshot — session too short)";

    const review = await chatCompletion(
      [
        {
          role: "system",
          content:
            "You are a senior technical interviewer writing a concise post-session review. Structure it in 4 short sections with these exact headers: Approach, Code quality, Complexity, Communication. Be specific and constructive; 1–2 sentences per section. No preamble.",
        },
        {
          role: "user",
          content: [
            `Problem: ${interview.problem?.title ?? "Unspecified"}`,
            interview.problem?.description?.slice(0, 1200) ?? "",
            `Candidate's final code (${interview.snapshots.at(-1)?.language ?? "?"}):\n${finalCode.slice(0, 5000)}`,
            `Snapshots recorded: ${interview.snapshots.length}`,
            `Host rating: ${interview.rating ?? "none"}`,
          ]
            .filter(Boolean)
            .join("\n\n"),
        },
      ],
      { maxTokens: 500, temperature: 0.3 }
    );

    const updated = await db.interview.update({
      where: { id: interview.id },
      data: { aiFeedback: review },
      select: { id: true, aiFeedback: true },
    });

    return NextResponse.json({ interview: updated }, { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.name === "AINotConfiguredError") {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error("[ai:feedback]", error);
    return NextResponse.json(
      { error: "AI request failed. Please try again." },
      { status: 502 }
    );
  }
}
