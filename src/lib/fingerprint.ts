import { createHash } from "crypto";

// Short public identifier of WHICH database this deployment talks to.
// Shown on /admin and /screen so two pages backed by different databases
// are visibly different instead of mysteriously out of sync.
export function dbFingerprint(): string {
  const url = process.env.SUPABASE_URL ?? "";
  if (!url) return "none";
  return createHash("sha256").update(url).digest("hex").slice(0, 6);
}

export function expectedHost(): string | null {
  try {
    const base = process.env.NEXT_PUBLIC_BASE_URL;
    if (!base) return null;
    return new URL(base).host;
  } catch {
    return null;
  }
}
