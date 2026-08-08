import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "kb_admin";
const SESSION_HOURS = 18; // covers the whole event night

function secret(): string {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) throw new Error("ADMIN_PASSWORD env var is not set");
  return pw;
}

function sign(expiresAt: number): string {
  const mac = createHmac("sha256", secret())
    .update(String(expiresAt))
    .digest("hex");
  return `${expiresAt}.${mac}`;
}

export function makeSessionCookieValue(): string {
  const expiresAt = Date.now() + SESSION_HOURS * 3600 * 1000;
  return sign(expiresAt);
}

export function verifySessionValue(value: string | undefined): boolean {
  if (!value) return false;
  const dot = value.indexOf(".");
  if (dot < 1) return false;
  const expiresAt = Number(value.slice(0, dot));
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;
  const expected = sign(expiresAt);
  const a = Buffer.from(value);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function isAdmin(): boolean {
  try {
    return verifySessionValue(cookies().get(COOKIE_NAME)?.value);
  } catch {
    return false;
  }
}

export function requireAdmin(): NextResponse | null {
  if (!isAdmin()) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  return null;
}

export function setSessionCookie(res: NextResponse): void {
  res.cookies.set(COOKIE_NAME, makeSessionCookieValue(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(COOKIE_NAME, "", { httpOnly: true, path: "/", maxAge: 0 });
}

// --- Login rate limiting: 5 attempts per minute per IP (in-memory) ---
const attempts = new Map<string, number[]>();

export function loginRateLimited(req: NextRequest): boolean {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const windowStart = now - 60_000;
  const list = (attempts.get(ip) ?? []).filter((t) => t > windowStart);
  if (list.length >= 5) {
    attempts.set(ip, list);
    return true;
  }
  list.push(now);
  attempts.set(ip, list);
  return false;
}

export function checkPassword(candidate: string): boolean {
  const pw = secret();
  const a = Buffer.from(candidate);
  const b = Buffer.from(pw);
  return a.length === b.length && timingSafeEqual(a, b);
}
