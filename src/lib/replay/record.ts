/**
 * Phase 9 — Replay recording.
 *
 * Appends lightweight events to the room's timeline. The replay player later
 * folds these left to right to reconstruct the session. Fire-and-forget:
 * recording failures are logged, never thrown, so they can't break the
 * feature they're recording.
 */
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export type CodeEventType =
  | "code"
  | "language"
  | "chat"
  | "submission"
  | "interview"
  | "problem";

export function recordCodeEvent(
  roomId: string,
  type: CodeEventType,
  userId: string,
  payload: Record<string, unknown>
): void {
  db.codeEvent
    .create({
      data: {
        roomId,
        type,
        userId,
        payload: payload as Prisma.InputJsonValue,
      },
    })
    .catch((error) =>
      console.error("[replay] record failed:", error?.message ?? error)
    );
}
