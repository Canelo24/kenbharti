import { getSettings } from "@/lib/settings";
import { APP_VERSION } from "@/lib/version";

export const dynamic = "force-dynamic";

// Public landing page. Guests normally never see this — their QR card
// takes them straight to their ballot — but it should still look the part.
export default async function Home() {
  let logo: string | null = null;
  try {
    logo = (await getSettings(["logo_url"]))["logo_url"] || null;
  } catch {
    /* database not configured yet — render without the logo */
  }

  return (
    <div className="warm-bg min-h-screen">
      <div className="flex h-1.5 w-full">
        <div className="flex-1 bg-brand-saffron" />
        <div className="flex-1 bg-white" />
        <div className="flex-1 bg-brand-green" />
        <div className="flex-1 bg-black" />
        <div className="flex-1 bg-red-600" />
      </div>
      <main className="mx-auto flex min-h-[calc(100vh-6px)] max-w-md flex-col items-center justify-center p-6 text-center">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logo}
            alt="Kenbharti Centre (Nairobi)"
            className="h-40 w-auto drop-shadow-[0_0_40px_rgba(255,153,51,0.25)]"
          />
        ) : (
          <div className="text-7xl">🦋</div>
        )}
        <h1 className="gold-text mt-6 font-display text-5xl font-extrabold">
          Maa Tujhe Salaam
        </h1>
        <p className="mt-1 font-display text-xl italic text-brand-champagne/80">
          18th Edition
        </p>
        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.35em] text-brand-gold/70">
          Kenbharti Centre · Nairobi
        </p>

        <div className="mt-10 w-full rounded-2xl border border-white/10 bg-white/5 p-6">
          <p className="text-3xl">🎟️</p>
          <p className="mt-2 text-lg font-bold">Have a voting card?</p>
          <p className="mt-1 text-sm text-white/60">
            Scan the QR code on your card with your phone&apos;s camera to vote
            and enter the raffle.
          </p>
        </div>
        <div className="mt-3 w-full rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm text-white/60">
            Lost or damaged card? Visit the help desk. 🙏
          </p>
        </div>

        <p className="mt-10 text-[10px] text-white/25">
          Kenbharti Centre (Nairobi) · {APP_VERSION} ·{" "}
          <a href="/admin" className="underline">
            organizers
          </a>
        </p>
      </main>
    </div>
  );
}
