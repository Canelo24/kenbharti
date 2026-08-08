import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

// On-screen QR preview for a single token (admin panel).
export async function GET(req: NextRequest) {
  const denied = requireAdmin();
  if (denied) return denied;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const { data: token } = await db()
    .from("tokens")
    .select("slug")
    .eq("id", id)
    .maybeSingle();
  if (!token) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const base =
    process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") || req.nextUrl.origin;
  const png = await QRCode.toBuffer(`${base}/v/${token.slug}`, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 480,
  });

  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
