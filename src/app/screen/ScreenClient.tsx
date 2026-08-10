"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { APP_VERSION } from "@/lib/version";
import { useWakeRefresh } from "@/lib/useWakeRefresh";

type Result = {
  id: number;
  name: string;
  photo_url: string | null;
  votes: number;
};
type Raffle = {
  draw_id: number;
  prize_name: string;
  display_code: string;
  holder_name: string;
};
type GalleryEntry = { id: number; name: string; photo_url: string | null };
type ScreenData = {
  mode: string;
  round?: string;
  round_status?: string;
  count?: number;
  gallery?: GalleryEntry[];
  results?: Result[] | null;
  raffle?: Raffle | null;
  logo_url?: string | null;
  fp?: string;
};

const ROUND_TITLE: Record<string, string> = {
  rangoli: "Rangoli Competition",
  dance: "Dance Competition",
};
const ROUND_ICON: Record<string, string> = { rangoli: "🎨", dance: "💃" };
const MODE_LABEL: Record<string, string> = {
  idle: "Idle",
  live_r1: "Live · Rangoli",
  results_r1: "Results · Rangoli",
  live_r2: "Live · Dance",
  results_r2: "Results · Dance",
  raffle: "Raffle",
};

export default function ScreenClient() {
  const [data, setData] = useState<ScreenData>({ mode: "idle" });
  const [connected, setConnected] = useState<boolean | null>(null);
  const lastOkAt = useRef(0);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/screen?t=${Date.now()}`, {
        cache: "no-store",
        // Abort black-holed requests so the pill can actually go red
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        setData(await res.json());
        setConnected(true);
        lastOkAt.current = Date.now();
      } else {
        if (Date.now() - lastOkAt.current > 8000) setConnected(false);
      }
    } catch {
      if (Date.now() - lastOkAt.current > 8000) setConnected(false);
    }
  }, []);

  useEffect(() => {
    poll();
    const id = setInterval(poll, 2500);
    // Independent watchdog: if no successful poll for 10s, show red —
    // even if a request somehow never settles.
    const watchdog = setInterval(() => {
      if (lastOkAt.current && Date.now() - lastOkAt.current > 10_000) {
        setConnected(false);
      }
    }, 2000);
    return () => {
      clearInterval(id);
      clearInterval(watchdog);
    };
  }, [poll]);

  // Re-sync instantly when the tab wakes from background/bfcache
  useWakeRefresh(poll);

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[radial-gradient(ellipse_at_top,#3a1d0b_0%,#241207_55%,#0c0502_100%)] p-8 text-center">
      {/* Tricolor frame */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex h-2">
        <div className="flex-1 bg-brand-saffron" />
        <div className="flex-1 bg-white" />
        <div className="flex-1 bg-brand-green" />
        <div className="flex-1 bg-black" />
        <div className="flex-1 bg-red-600" />
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-2">
        <div className="flex-1 bg-red-600" />
        <div className="flex-1 bg-black" />
        <div className="flex-1 bg-brand-green" />
        <div className="flex-1 bg-white" />
        <div className="flex-1 bg-brand-saffron" />
      </div>

      {/* Corner branding (hidden in idle — idle shows it big) */}
      {data.mode !== "idle" && (
        <div className="pointer-events-none absolute left-8 top-8 flex items-center gap-4">
          {data.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.logo_url} alt="" className="h-20 w-auto drop-shadow-2xl" />
          ) : null}
          <div className="text-left">
            <p className="text-xl font-black tracking-[0.25em] text-brand-gold/90">
              KENBHARTI
            </p>
            <p className="text-sm tracking-[0.2em] text-white/40">
              MAA TUJHE SALAM
            </p>
          </div>
        </div>
      )}

      {/* Connection status — small but always visible for the operator */}
      <div className="absolute bottom-5 right-6 flex items-center gap-2 rounded-full border border-white/10 bg-black/50 px-3 py-1.5 text-xs text-white/60">
        <span
          className={`h-2.5 w-2.5 rounded-full ${
            connected === false
              ? "bg-red-500"
              : connected
                ? "bg-green-400"
                : "bg-yellow-400"
          }`}
        />
        {connected === false
          ? "Reconnecting…"
          : `LIVE · ${MODE_LABEL[data.mode] ?? data.mode}`}{" "}
        · {APP_VERSION}
        {data.fp ? ` · db ${data.fp}` : ""}
      </div>

      <AnimatePresence mode="wait">
        {data.mode === "idle" && <IdleView key="idle" logo={data.logo_url} />}
        {(data.mode === "live_r1" || data.mode === "live_r2") && (
          <LiveView
            key={data.mode}
            round={data.round ?? ""}
            count={data.count ?? 0}
            roundStatus={data.round_status ?? "open"}
            gallery={data.gallery ?? []}
          />
        )}
        {(data.mode === "results_r1" || data.mode === "results_r2") && (
          <ResultsView
            key={data.mode}
            round={data.round ?? ""}
            results={data.results ?? null}
          />
        )}
        {data.mode === "raffle" && (
          <RaffleView key="raffle" raffle={data.raffle ?? null} />
        )}
      </AnimatePresence>
    </main>
  );
}

function IdleView({ logo }: { logo?: string | null }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center gap-7"
    >
      <GoldSparks />
      {/* Mandala halo behind the logo, echoing the poster */}
      <div className="relative flex items-center justify-center">
        <div className="absolute h-[26rem] w-[26rem] animate-[spin_90s_linear_infinite] rounded-full border border-brand-gold/20 [mask-image:radial-gradient(circle,black_60%,transparent_72%)]">
          <div className="absolute inset-4 rounded-full border border-dashed border-brand-gold/25" />
          <div className="absolute inset-10 rounded-full border border-brand-gold/15" />
        </div>
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <motion.img
            src={logo}
            alt="Kenbharti"
            className="relative h-56 w-auto drop-shadow-[0_0_70px_rgba(232,185,35,0.35)]"
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          />
        ) : (
          <div className="relative text-9xl">🦋</div>
        )}
      </div>
      <div>
        <h1 className="gold-text font-display text-8xl font-extrabold leading-tight drop-shadow-[0_2px_20px_rgba(232,185,35,0.25)] md:text-9xl">
          Maa Tujhe Salam
        </h1>
        <p className="mt-2 font-display text-4xl italic text-brand-champagne/90">
          18th Edition
        </p>
        <p className="mt-4 text-xl font-semibold uppercase tracking-[0.5em] text-brand-cream/60">
          Kenbharti Centre · Nairobi
        </p>
      </div>
      <p className="kb-pulse text-2xl text-brand-cream/60">
        🪔 Celebrate the heartbeat of our community 🪔
      </p>
    </motion.div>
  );
}

// Gentle golden specks drifting upward — poster sparkle, projector-cheap.
function GoldSparks() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const sparks = Array.from({ length: 42 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: 0.8 + Math.random() * 2.2,
      vy: 0.15 + Math.random() * 0.45,
      tw: Math.random() * Math.PI * 2,
    }));
    let raf = 0;
    const frame = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const s of sparks) {
        s.y -= s.vy;
        s.tw += 0.03;
        if (s.y < -5) {
          s.y = canvas.height + 5;
          s.x = Math.random() * canvas.width;
        }
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(232,185,35,${0.25 + 0.35 * Math.abs(Math.sin(s.tw))})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 -z-10"
      aria-hidden
    />
  );
}

// ---------------- Live counter ----------------

function LiveView({
  round,
  count,
  roundStatus,
  gallery,
}: {
  round: string;
  count: number;
  roundStatus: string;
  gallery: GalleryEntry[];
}) {
  const [display, setDisplay] = useState(count);
  const target = useRef(count);
  const isOpen = roundStatus === "open";
  // Rangoli gallery: rotate through the artworks people are voting on.
  const photos = round === "rangoli" ? gallery.filter((g) => g.photo_url) : [];
  const [photoIdx, setPhotoIdx] = useState(0);

  useEffect(() => {
    target.current = count;
    const id = setInterval(() => {
      setDisplay((d) => {
        if (d === target.current) return d;
        const step = Math.max(1, Math.ceil(Math.abs(target.current - d) / 8));
        return d < target.current ? d + step : d - step;
      });
    }, 60);
    return () => clearInterval(id);
  }, [count]);

  useEffect(() => {
    if (photos.length < 2) return;
    const id = setInterval(
      () => setPhotoIdx((i) => (i + 1) % photos.length),
      5000
    );
    return () => clearInterval(id);
  }, [photos.length]);

  const current = photos.length > 0 ? photos[photoIdx % photos.length] : null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      className="flex w-full max-w-7xl flex-col items-center gap-6"
    >
      {isOpen ? (
        <div className="rounded-full border border-green-400/40 bg-green-500/10 px-8 py-2">
          <p className="flex items-center gap-3 text-2xl font-bold text-green-300">
            <span className="inline-block h-3 w-3 animate-ping rounded-full bg-green-400" />
            VOTING OPEN
          </p>
        </div>
      ) : (
        <div className="rounded-full border border-yellow-400/40 bg-yellow-500/10 px-8 py-2">
          <p className="text-2xl font-bold text-yellow-300">
            🔒 VOTING CLOSED — final count
          </p>
        </div>
      )}
      <h1 className="gold-text font-display text-6xl font-extrabold md:text-7xl">
        {ROUND_ICON[round]} {ROUND_TITLE[round] ?? "Voting"}
      </h1>

      <div
        className={`flex w-full items-center justify-center gap-10 ${
          current ? "flex-row" : "flex-col"
        }`}
      >
        <div className="rounded-[3rem] border border-brand-gold/20 bg-black/40 px-20 py-6 shadow-[0_0_80px_rgba(232,185,35,0.15)]">
          <p className="text-2xl uppercase tracking-[0.3em] text-brand-cream/50">
            Votes received
          </p>
          <div className="bg-gradient-to-b from-brand-cream to-brand-champagne/70 bg-clip-text text-[10rem] font-black leading-none tabular-nums text-transparent md:text-[13rem]">
            {display}
          </div>
        </div>

        {current && (
          <div className="w-[26rem] max-w-[38vw]">
            <AnimatePresence mode="wait">
              <motion.div
                key={current.id}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6 }}
                className="overflow-hidden rounded-3xl border-2 border-brand-gold/40 bg-black/40 shadow-2xl"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={current.photo_url!}
                  alt={current.name}
                  className="aspect-square w-full object-cover"
                />
                <p className="truncate p-4 font-display text-3xl font-bold text-brand-champagne">
                  {current.name}
                </p>
              </motion.div>
            </AnimatePresence>
            {photos.length > 1 && (
              <div className="mt-3 flex justify-center gap-2">
                {photos.map((p, i) => (
                  <span
                    key={p.id}
                    className={`h-2 w-2 rounded-full ${
                      i === photoIdx % photos.length
                        ? "bg-brand-gold"
                        : "bg-brand-gold/25"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {isOpen ? (
        <p className="kb-pulse text-3xl font-semibold text-brand-gold">
          📱 Scan your card &amp; vote now!
        </p>
      ) : (
        <p className="text-3xl font-semibold text-brand-cream/50">
          Results coming up shortly…
        </p>
      )}
    </motion.div>
  );
}

// ---------------- Results reveal ----------------

function ResultsView({
  round,
  results,
}: {
  round: string;
  results: Result[] | null;
}) {
  const confettiFired = useRef(false);
  const sorted = results ? [...results].sort((a, b) => b.votes - a.votes) : [];
  // Handle ties: every entry sharing the top (non-zero) count is a winner
  const topVotes = sorted.length > 0 ? sorted[0].votes : 0;
  const winners = topVotes > 0 ? sorted.filter((r) => r.votes === topVotes) : [];
  const isTie = winners.length > 1;
  const winnerIds = new Set(winners.map((r) => r.id));
  const max = Math.max(1, topVotes);
  const display = results ? [...results].sort((a, b) => a.id - b.id) : [];
  // Staged reveal: bars fill from LAST place upward, winner's bar last —
  // built-in drama for the MC. Rows stay in stable order; only the
  // animation timing follows the ranking.
  const STAGE = 1.4;
  const ascending = [...sorted].reverse();
  const delayFor = new Map<number, number>(
    ascending.map((r, i) => [r.id, i * STAGE])
  );
  const revealSeconds = Math.max(0, (display.length - 1) * STAGE) + 1.0;

  // Depend on stable primitives, not the array reference — otherwise every
  // 2.5s poll would cancel the pending confetti timer before it fires.
  const hasResults = !!results && results.length > 0;
  useEffect(() => {
    if (hasResults && !confettiFired.current) {
      confettiFired.current = true;
      const t = setTimeout(() => fireConfetti(), (revealSeconds + 0.4) * 1000);
      return () => clearTimeout(t);
    }
  }, [hasResults, revealSeconds]);

  if (!results) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <h1 className="text-6xl font-black text-brand-saffron">
          {ROUND_ICON[round]} {ROUND_TITLE[round] ?? ""}
        </h1>
        <p className="kb-pulse mt-10 text-5xl font-bold text-white/80">
          Results coming up…
        </p>
        <p className="mt-8 text-lg text-white/30">
          (waiting for the reveal from the control room)
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="w-full max-w-6xl"
    >
      <h1 className="gold-text mb-12 font-display text-6xl font-extrabold md:text-7xl">
        {ROUND_ICON[round]} {ROUND_TITLE[round] ?? ""} — Results
      </h1>
      <div className="space-y-5">
        {display.map((r) => {
          const isWinner = winnerIds.has(r.id);
          const delay = delayFor.get(r.id) ?? 0;
          return (
            <div key={r.id} className="flex items-center gap-5 text-left">
              {r.photo_url ? (
                <motion.img
                  src={r.photo_url}
                  alt=""
                  initial={{ opacity: 0.35 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay }}
                  className={`h-16 w-16 flex-none rounded-xl border object-cover ${
                    isWinner ? "border-brand-gold" : "border-white/15"
                  }`}
                />
              ) : (
                <div className="h-16 w-16 flex-none rounded-xl border border-white/10 bg-white/5" />
              )}
              <span
                className={`w-64 truncate text-4xl font-bold md:w-80 ${
                  isWinner ? "text-brand-gold" : "text-brand-cream"
                }`}
              >
                {isWinner && "👑 "}
                {r.name}
              </span>
              <div className="h-14 flex-1 overflow-hidden rounded-2xl bg-white/10 shadow-inner">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(r.votes / max) * 100}%` }}
                  transition={{ delay, duration: 0.8, ease: "easeOut" }}
                  className={`h-full rounded-2xl ${
                    isWinner
                      ? "bg-gradient-to-r from-brand-gold via-amber-400 to-brand-saffron shadow-lg shadow-amber-500/50"
                      : "bg-brand-saffron/50"
                  }`}
                />
              </div>
              <motion.span
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: delay + 0.7 }}
                className="w-28 text-right text-5xl font-black tabular-nums"
              >
                {r.votes}
              </motion.span>
            </div>
          );
        })}
      </div>
      {winners.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: revealSeconds + 0.3, type: "spring", bounce: 0.4 }}
          className="mt-14 inline-block rounded-3xl border-2 border-brand-gold/60 bg-gradient-to-r from-brand-gold/20 to-brand-saffron/10 px-16 py-6"
        >
          <p className="font-display text-6xl font-extrabold text-brand-gold md:text-7xl">
            🏆 {isTie ? "It's a tie! " : ""}
            {winners.map((w) => w.name).join(" & ")} 🏆
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}

// ---------------- Raffle slot machine ----------------

function RaffleView({ raffle }: { raffle: Raffle | null }) {
  const [spinCode, setSpinCode] = useState<string | null>(null);
  const [landed, setLanded] = useState<Raffle | null>(null);
  const lastDrawId = useRef<number | null>(null);

  useEffect(() => {
    if (!raffle) return;
    if (raffle.draw_id === lastDrawId.current) return;
    lastDrawId.current = raffle.draw_id;
    setLanded(null);

    const start = performance.now();
    const duration = 4000;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const elapsed = performance.now() - start;
      if (elapsed >= duration) {
        setSpinCode(null);
        setLanded(raffle);
        fireConfetti();
        return;
      }
      const n = 1 + Math.floor(Math.random() * 800);
      setSpinCode(`KB-${String(n).padStart(4, "0")}`);
      const delay = 40 + 220 * Math.pow(elapsed / duration, 2.2);
      timer = setTimeout(tick, delay);
    };
    tick();
    return () => clearTimeout(timer);
    // Depend on draw_id only: each poll delivers a NEW raffle object with
    // the same contents, and re-running this effect would clearTimeout the
    // in-flight spin and freeze it on a random non-winner code.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raffle?.draw_id]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center gap-8"
    >
      <p className="text-4xl font-black tracking-[0.4em] text-brand-gold/80">
        🎁 RAFFLE 🎁
      </p>
      {!raffle && (
        <h1 className="kb-pulse text-7xl font-black text-brand-gold">
          Get your cards ready…
        </h1>
      )}
      {raffle && (
        <>
          <h1 className="gold-text font-display text-7xl font-extrabold md:text-8xl">
            {raffle.prize_name.toLowerCase().includes("flight") ? "✈️" : "🧺"}{" "}
            {raffle.prize_name}
          </h1>
          <div
            className={`rounded-[2.5rem] border-4 bg-black/50 px-20 py-12 shadow-2xl transition-colors ${
              landed
                ? "border-brand-gold shadow-amber-500/30"
                : "border-white/20"
            }`}
          >
            {spinCode && (
              <span className="font-mono text-9xl font-black tabular-nums text-white/70">
                {spinCode}
              </span>
            )}
            {landed && (
              <motion.div
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", bounce: 0.5 }}
                className="flex flex-col items-center gap-5"
              >
                <span className="bg-gradient-to-b from-brand-gold to-brand-saffron bg-clip-text font-mono text-9xl font-black text-transparent">
                  {landed.display_code}
                </span>
                {landed.holder_name && (
                  <span className="text-7xl font-black text-white">
                    {landed.holder_name}
                  </span>
                )}
              </motion.div>
            )}
            {!spinCode && !landed && (
              <span className="font-mono text-9xl font-black text-white/20">
                KB-????
              </span>
            )}
          </div>
          {landed && (
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-5xl font-bold text-brand-gold"
            >
              🎉 Come up to the stage! 🎉
            </motion.p>
          )}
        </>
      )}
    </motion.div>
  );
}

// ---------------- Tiny confetti (no dependency) ----------------

function fireConfetti() {
  const canvas = document.createElement("canvas");
  canvas.style.cssText =
    "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:9999";
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    canvas.remove();
    return;
  }
  const colors = ["#FF9933", "#ffffff", "#138808", "#e8b923", "#ff5e7e"];
  const pieces = Array.from({ length: 260 }, () => ({
    x: Math.random() * canvas.width,
    y: -20 - Math.random() * canvas.height * 0.5,
    w: 6 + Math.random() * 8,
    h: 8 + Math.random() * 10,
    vx: -2 + Math.random() * 4,
    vy: 2.5 + Math.random() * 4,
    rot: Math.random() * Math.PI,
    vr: -0.12 + Math.random() * 0.24,
    color: colors[Math.floor(Math.random() * colors.length)],
  }));
  const start = performance.now();
  const DURATION = 5000;
  function frame(now: number) {
    if (!ctx) return;
    const t = now - start;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of pieces) {
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, 1 - t / DURATION);
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (t < DURATION) requestAnimationFrame(frame);
    else canvas.remove();
  }
  requestAnimationFrame(frame);
}
