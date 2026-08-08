import { NextRequest, NextResponse } from "next/server";
import {
  checkPassword,
  loginRateLimited,
  setSessionCookie,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (loginRateLimited(req)) {
    return NextResponse.json(
      { error: "Too many attempts — wait a minute and try again" },
      { status: 429 }
    );
  }
  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  if (!body.password || !checkPassword(body.password)) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  setSessionCookie(res);
  return res;
}
