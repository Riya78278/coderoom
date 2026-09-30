/**
 * Phase 10 — plain-JS notification bridge for server.mjs (which can't import
 * TypeScript directly). Mirrors src/lib/notify.ts: create rows, push live to
 * the user's personal socket room. Best-effort, never throws.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

export async function notifyUsers(
  userIds,
  { type, title, body = null, roomId = null, actorName = null }
) {
  if (!Array.isArray(userIds) || userIds.length === 0) return;
  try {
    const created = await Promise.all(
      userIds.map((userId) =>
        db.notification.create({
          data: { userId, type, title, body, roomId, actorName },
        })
      )
    );
    const io = globalThis.__coderoomIO;
    if (io?.to) {
      for (const notification of created) {
        io.to(`user:${notification.userId}`).emit("notification", notification);
      }
    }
  } catch (error) {
    console.error("[notify-bridge] failed:", error?.message ?? error);
  }
}
