import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "@/lib/db";
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  createSessionToken,
  verifySessionToken,
  type SessionPayload,
  type SessionUser,
} from "@/lib/session-token";

/**
 * Session model (Phase 1): stateless JWT in an httpOnly cookie,
 * signed with AUTH_SECRET. Server-side helpers below run only in
 * Route Handlers / Server Components (Node runtime).
 *
 * Re-exported for convenience of server callers:
 */
export { SESSION_COOKIE, createSessionToken, verifySessionToken };
export type { SessionPayload, SessionUser };

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

/**
 * Session straight from the signed token — no database round-trip.
 * Used by the dashboard shell in Phase 1.
 */
export async function getSessionPayload(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
}

/**
 * Session revalidated against the database (user still exists, fresh name).
 * Cached per request. Used by room/feature pages from Phase 2 onward.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const cookieStore = await cookies();
  const payload = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  if (!payload) return null;

  const user = await db.user.findUnique({
    where: { id: payload.id },
    select: { id: true, name: true, email: true },
  });
  return user ?? null;
});
