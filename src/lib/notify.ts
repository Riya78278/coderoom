import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

type MinimalIO = {
  to: (room: string) => {
    emit: (event: string, payload: unknown) => boolean;
  };
};

function io(): MinimalIO | undefined {
  return (globalThis as { __coderoomIO?: MinimalIO }).__coderoomIO;
}

export type NotifyType = "JOIN" | "CHAT" | "INTERVIEW" | "PROBLEM";

/**
 * Phase 10 — create notifications for the given users and push them live to
 * any of those users connected to this instance. Best-effort: never throws.
 */
export async function notifyUsers(
  userIds: string[],
  n: {
    type: NotifyType;
    title: string;
    body?: string;
    roomId?: string | null;
    actorName?: string | null;
    excludeUserId?: string | null;
  }
): Promise<void> {
  const targets = userIds.filter((id) => id && id !== n.excludeUserId);
  if (targets.length === 0) return;
  try {
    const created = await db.notification.createManyAndReturn({
      data: targets.map((userId) => ({
        userId,
        type: n.type,
        title: n.title,
        body: n.body ?? null,
        roomId: n.roomId ?? null,
        actorName: n.actorName ?? null,
      })),
    });
    const ioServer = io();
    for (const notification of created) {
      ioServer?.to(`user:${notification.userId}`).emit("notification", notification);
    }
  } catch (error) {
    console.error("[notify] failed:", error instanceof Error ? error.message : error);
  }
}

/** Count unread + fetch latest 20 — shape used by the bell and pages. */
export async function notificationSummary(userId: string) {
  const [unread, latest] = await Promise.all([
    db.notification.count({ where: { userId, readAt: null } }),
    db.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        roomId: true,
        actorName: true,
        readAt: true,
        createdAt: true,
      },
    }),
  ]);
  return { unread, latest };
}
