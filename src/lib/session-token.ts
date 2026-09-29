/**
 * Edge-safe session token utilities (no database, no next/headers).
 * Used by both proxy.ts (route protection) and session.ts (server components).
 */
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "coderoom_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export type SessionUser = {
  id: string;
  name: string;
  email: string;
};

export type SessionPayload = SessionUser & { exp: number };

const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? "dev-only-insecure-secret-change-me"
);

export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({ name: user.name, email: user.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secret);
}

/** Verifies the JWT signature + expiry. Returns null for any invalid/expired token. */
export async function verifySessionToken(
  token: string | undefined
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    if (!payload.sub) return null;
    return {
      id: payload.sub,
      name: String(payload.name ?? ""),
      email: String(payload.email ?? ""),
      exp: payload.exp ?? 0,
    };
  } catch {
    return null;
  }
}
