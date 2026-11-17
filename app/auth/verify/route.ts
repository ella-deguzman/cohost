import { NextResponse, type NextRequest } from "next/server";
import { consumeLoginToken, SESSION_COOKIE, SESSION_DAYS, startSession } from "@/lib/auth";

// The page the emailed sign-in link opens. It checks the one-time token,
// starts a session, and sends the person to their events.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const base = process.env.APP_URL ?? req.nextUrl.origin;

  const email = token ? await consumeLoginToken(token) : null;
  if (!email) return NextResponse.redirect(new URL("/signin?error=expired", base));

  const session = await startSession(email);
  const res = NextResponse.redirect(new URL("/events", base));
  res.cookies.set(SESSION_COOKIE, session, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * SESSION_DAYS,
  });
  return res;
}
