import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { isRound } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
export const maxDuration = 30;

// Compress any uploaded photo to WebP <= 60KB (spec §0.4).
async function toSmallWebp(buf: Buffer): Promise<Buffer> {
  const base = sharp(buf).rotate().resize(800, 800, {
    fit: "inside",
    withoutEnlargement: true,
  });
  for (const quality of [78, 62, 48, 36, 26]) {
    const out = await base.webp({ quality }).toBuffer();
    if (out.length <= 60 * 1024) return out;
  }
  // Last resort: shrink harder
  return sharp(buf)
    .rotate()
    .resize(480, 480, { fit: "inside" })
    .webp({ quality: 30 })
    .toBuffer();
}

// POST multipart/form-data:
//   action = create | update | delete
//   id (for update/delete), round, name, sort, active, photo (file, optional)
export async function POST(req: NextRequest) {
  const denied = requireAdmin();
  if (denied) return denied;

  const form = await req.formData();
  const action = String(form.get("action") ?? "");

  if (action === "delete") {
    const id = Number(form.get("id"));
    if (!Number.isInteger(id)) {
      return NextResponse.json({ error: "Bad id" }, { status: 400 });
    }
    // Entries that already have votes must never vanish from results —
    // deactivate instead of delete when votes exist.
    const { count } = await db()
      .from("votes")
      .select("id", { count: "exact", head: true })
      .eq("entry_id", id);
    if ((count ?? 0) > 0) {
      await db().from("entries").update({ active: false }).eq("id", id);
      return NextResponse.json({ ok: true, deactivated: true });
    }
    const { error } = await db().from("entries").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const round = String(form.get("round") ?? "");
  const name = String(form.get("name") ?? "").trim();
  const sort = Number(form.get("sort") ?? 0) || 0;
  const active = String(form.get("active") ?? "true") === "true";

  if (action === "create" && (!isRound(round) || !name)) {
    return NextResponse.json({ error: "Round and name required" }, { status: 400 });
  }

  // Optional photo upload -> Supabase Storage 'photos' bucket.
  // Two copies: a tiny one for phones (<=60KB) and a high-quality one
  // for the projector (rangoli detail deserves better than 60KB on a
  // 4-metre screen).
  let photo_url: string | undefined;
  let photo_screen_url: string | undefined;
  const file = form.get("photo");
  if (file && file instanceof File && file.size > 0) {
    if (file.size > 15 * 1024 * 1024) {
      return NextResponse.json({ error: "Photo too large (max 15MB)" }, { status: 400 });
    }
    const original = Buffer.from(await file.arrayBuffer());
    const webp = await toSmallWebp(original);
    const screenWebp = await sharp(original)
      .rotate()
      .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    const stem = `entries/${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const path = `${stem}.webp`;
    const screenPath = `${stem}-screen.webp`;

    let { error: upErr } = await db()
      .storage.from("photos")
      .upload(path, webp, { contentType: "image/webp", upsert: false });
    if (upErr && /not found|bucket/i.test(upErr.message)) {
      // Bucket missing (schema step skipped) — create it and retry once.
      await db().storage.createBucket("photos", { public: true });
      ({ error: upErr } = await db()
        .storage.from("photos")
        .upload(path, webp, { contentType: "image/webp", upsert: false }));
    }
    if (upErr) {
      return NextResponse.json({ error: `Upload failed: ${upErr.message}` }, { status: 500 });
    }
    photo_url = db().storage.from("photos").getPublicUrl(path).data.publicUrl;

    const { error: screenErr } = await db()
      .storage.from("photos")
      .upload(screenPath, screenWebp, { contentType: "image/webp", upsert: false });
    if (!screenErr) {
      photo_screen_url = db()
        .storage.from("photos")
        .getPublicUrl(screenPath).data.publicUrl;
    }
  }

  if (action === "create") {
    const row: Record<string, unknown> = {
      round,
      name,
      sort,
      active,
      photo_url: photo_url ?? null,
    };
    if (photo_screen_url) row.photo_screen_url = photo_screen_url;
    let { error } = await db().from("entries").insert(row);
    if (error && /photo_screen_url/.test(error.message)) {
      // v9 migration not run yet — save without the projector copy
      delete row.photo_screen_url;
      ({ error } = await db().from("entries").insert(row));
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "update") {
    const id = Number(form.get("id"));
    if (!Number.isInteger(id)) {
      return NextResponse.json({ error: "Bad id" }, { status: 400 });
    }
    const patch: Record<string, unknown> = { sort, active };
    if (name) patch.name = name;
    if (photo_url) patch.photo_url = photo_url;
    if (photo_screen_url) patch.photo_screen_url = photo_screen_url;
    let { error } = await db().from("entries").update(patch).eq("id", id);
    if (error && /photo_screen_url/.test(error.message)) {
      delete patch.photo_screen_url;
      ({ error } = await db().from("entries").update(patch).eq("id", id));
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
