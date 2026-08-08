import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { setSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Upload the event logo once from the admin panel; it then shows on the
// voter pages and the projector. Stored in the public photos bucket.
export async function POST(req: NextRequest) {
  const denied = requireAdmin();
  if (denied) return denied;

  const form = await req.formData();
  const file = form.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "No file" }, { status: 400 });
  }
  if (file.size > 15 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 15MB)" }, { status: 400 });
  }

  const png = await sharp(Buffer.from(await file.arrayBuffer()))
    .rotate()
    .resize(600, 600, { fit: "inside", withoutEnlargement: true })
    .png() // keep transparency if the logo has it
    .toBuffer();

  const path = `branding/logo-${Date.now()}.png`;
  let { error: upErr } = await db()
    .storage.from("photos")
    .upload(path, png, { contentType: "image/png", upsert: true });
  if (upErr && /not found|bucket/i.test(upErr.message)) {
    await db().storage.createBucket("photos", { public: true });
    ({ error: upErr } = await db()
      .storage.from("photos")
      .upload(path, png, { contentType: "image/png", upsert: true }));
  }
  if (upErr) {
    return NextResponse.json({ error: `Upload failed: ${upErr.message}` }, { status: 500 });
  }

  const url = db().storage.from("photos").getPublicUrl(path).data.publicUrl;
  await setSetting("logo_url", url);
  return NextResponse.json({ ok: true, url });
}
