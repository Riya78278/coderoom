import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { gradeSubmission } from "@/lib/execution/run";
import { emitToRoom } from "@/lib/realtime-emit";
import { recordCodeEvent } from "@/lib/replay/record";

type RouteContext = { params: Promise<{ id: string }> };

const execSchema = z.object({
  mode: z.enum(["run", "submit"]),
});

const BROADCAST_SECRET =
  process.env.INTERNAL_BROADCAST_SECRET ??
  (process.env.NODE_ENV !== "production" ? "dev-internal" : undefined);

/**
 * POST /api/rooms/:id/execute
 * mode=run    → sample cases only, nothing persisted
 * mode=submit → all cases, persisted as a Submission, broadcast live
 */
export async function POST(request: Request, { params }: RouteContext) {
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

    const body = await request.json().catch(() => null);
    const parsed = execSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input." }, { status: 400 });
    }
    const { mode } = parsed.data;

    const room = await db.room.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        language: true,
        status: true,
        problem: { select: { id: true, slug: true } },
      },
    });
    if (!room) {
      return NextResponse.json({ error: "Room not found." }, { status: 404 });
    }
    if (room.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "This room has ended — execution is disabled." },
        { status: 400 }
      );
    }

    if (!room.problem) {
      return NextResponse.json(
        { error: "No problem selected for this room." },
        { status: 400 }
      );
    }

    const cases = await db.testCase.findMany({
      where: { problemId: room.problem.id, ...(mode === "run" ? { isSample: true } : {}) },
      orderBy: { createdAt: "asc" },
    });
    if (cases.length === 0) {
      return NextResponse.json(
        { error: "No test cases available for this problem." },
        { status: 400 }
        );
    }

    const grade = await gradeSubmission({
      language: room.language,
      code: room.code,
      problemSlug: room.problem.slug,
      cases,
    });

    let submission = null;
    if (mode === "submit") {
      submission = await db.submission.create({
        data: {
          roomId: room.id,
          userId: user.id,
          problemId: room.problem.id,
          language: room.language,
          code: room.code,
          verdict: grade.verdict,
          passed: grade.passed,
          total: grade.total,
          runtimeMs: grade.runtimeMs,
          stderr: grade.stderr,
          results: grade.results,
        },
      });

      // Live broadcast to everyone in the room. Preferred path: emit
      // directly through the Socket.IO server this process already owns
      // (server.mjs exposes it as a global — no HTTP hop, no secrets).
      // Fallback: the internal HTTP bridge in server.mjs. Failures are
      // logged, never silently swallowed.
      // Timeline record (Phase 9) + live broadcast.
      recordCodeEvent(room.id, "submission", user.id, {
        verdict: grade.verdict,
        passed: grade.passed,
        total: grade.total,
        name: user.name,
        mode,
      });
      const broadcastPayload = {
        submissionId: submission.id,
        userId: user.id,
        name: user.name,
        verdict: grade.verdict,
        passed: grade.passed,
        total: grade.total,
        runtimeMs: grade.runtimeMs,
        at: new Date().toISOString(),
      };
      const delivered = emitToRoom(room.id, "submission:result", broadcastPayload);
      if (delivered) {
        console.log(
          `[execute] broadcast submission:result → room ${room.id} (delivered: true)`
        );
      } else if (BROADCAST_SECRET) {
        try {
          const bridgeRes = await fetch(
            `${new URL(request.url).origin}/api/internal/broadcast`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                secret: BROADCAST_SECRET,
                roomId: room.id,
                event: "submission:result",
                payload: broadcastPayload,
              }),
            }
          );
          if (!bridgeRes.ok) {
            console.error(`[execute] broadcast bridge responded ${bridgeRes.status}`);
          }
        } catch (error) {
          console.error("[execute] broadcast bridge fetch failed:", error);
        }
      } else {
        console.warn(
          "[execute] no broadcast path: io global missing and no INTERNAL_BROADCAST_SECRET"
        );
      }
    }

    return NextResponse.json(
      { verdict: grade.verdict, passed: grade.passed, total: grade.total, runtimeMs: grade.runtimeMs, results: grade.results, submissionId: submission?.id ?? null },
      { status: 200 }
    );
  } catch (error) {
    console.error("[execute]", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
