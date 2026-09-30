import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { notificationSummary } from "@/lib/notify";

/** GET /api/notifications — unread count + latest 20 (any signed-in user). */
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const summary = await notificationSummary(user.id);
    return NextResponse.json(summary, { status: 200 });
  } catch (error) {
    console.error("[notifications:GET]", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}

const patchSchema = z.object({
  markRead: z.enum(["one", "all"]),
  id: z.string().cuid().optional(),
});

/** PATCH /api/notifications — mark one or all as read. */
export async function PATCH(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const body = await request.json().catch(() => null);
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input." }, { status: 400 });
    }

    if (parsed.data.markRead === "all") {
      await db.notification.updateMany({
        where: { userId: user.id, readAt: null },
        data: { readAt: new Date() },
      });
    } else {
      if (!parsed.data.id) {
        return NextResponse.json({ error: "Missing id." }, { status: 400 });
      }
      await db.notification.updateMany({
        where: { id: parsed.data.id, userId: user.id },
        data: { readAt: new Date() },
      });
    }
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("[notifications:PATCH]", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
