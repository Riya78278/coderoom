import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session-token";

/**
 * Next.js 16 route protection (proxy.ts replaces the deprecated middleware.ts).
 * Edge-safe: verifies the JWT signature only — no database access here.
 */

const PROTECTED_PREFIXES = ["/dashboard", "/room"];
const AUTH_PAGES = ["/login", "/register"];

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const session = await verifySessionToken(
    request.cookies.get(SESSION_COOKIE)?.value
  );

  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  if (isProtected && !session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (AUTH_PAGES.includes(pathname) && session) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/room/:path*", "/login", "/register"],
};
