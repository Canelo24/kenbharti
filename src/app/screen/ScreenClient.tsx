"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

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
type ScreenData = {
  mode: string;
  round?: string;
  count?: number;
  results?: Result[] | null;
  raffle?: Raffle | null;
};

const ROUND_TITLE: Record<string, string> = {
  rangoli: "Rangoli Competition",
  dance: "Dance Competition",
};

export default function ScreenClient() {
  const [data, setData] = useState<ScreenData>({ mode: "idle" });

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/screen", { cache: "no-store" });
      if (res.ok) setData(await res.json());
    } catch {
      /* keep last good frame; try again next tick */
    }
  }, []);

  useEffect(() => {
    poll();
    const id = setInterval(poll, 2500);
    return () => clearInterval(id);
  }, [poll]);

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-brand-navy p-8 text-center">
      <Branding />
      <AnimatePresence mode="wait">
        {data.mode === "idle" && <IdleView key="idle" />}
        {(data.mode === "live_r1" || data.mode === "live_r2") && (
          <LiveView
            key={data.mode}
            round={data.round ?? ""}
            count={data.count ?? 0}
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

function Branding() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-6 text-center">
      <p className="text-2xl tracking-[0.4em] text-brand-gold/80">KENBHARTI</p>
    </div>
  );
}

function IdleView() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center gap-6"
    >
      <div className="text-8xl">🇮🇳 🇰🇪</div>
      <h1 className="bg-gradient-to-r from-brand-saffron via-white to-brand-green bg-clip-text text-7xl font-extrabold text-transparent md:text-8xl">
        Maa Tujhe Salaam
      </h1>
      <p className="kb-pulse text-3xl text-white/70">
        Live voting &amp; raffle tonight
      </p>
    </motion.div>
  );
}

// ---------------- Live counter ----------------

function LiveView({ round, count }: { round: string; count: number }) {
  const [display, setDisplay] = useState(count);
  const target = useRef(count);

  // Tick smoothly toward the latest count
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

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center gap-8"
    >
      <h1 className="text-5xl font-bold text-brand-saffron md:text-6xl">
        {ROUND_TITLE[round] ?? "Voting"}
      </h1>
      <p className="text-3xl text-white/70">Votes received</p>
      <div className="text-[11rem] font-extrabold leading-none tabular-nums text-white md:text-[16rem]">
        {display}
      </div>
      <p className="kb-pulse text-3xl text-brand-gold">
        📱 Scan your card &amp; vote now!
      </p>
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
  const max = sorted.length > 0 ? Math.max(1, sorted[0].votes) : 1;
  const winnerId = sorted.length > 0 ? sorted[0].id : null;
  const display = results
    ? [...results].sort((a, b) => a.id - b.id) // stable order on screen
    : [];
  const revealSeconds = display.length * 0.9;

  useEffect(() => {
    if (results && results.length > 0 && !confettiFired.current) {
      confettiFired.current = true;
      const t = setTimeout(
        () => fireConfetti(),
        (revealSeconds + 0.4) * 1000
      );
      return () => clearTimeout(t);
    }
  }, [results, revealSeconds]);

  if (!results) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <h1 className="text-5xl font-bold text-brand-saffron">
          {ROUND_TITLE[round] ?? ""}
        </h1>
        <p className="kb-pulse mt-8 text-4xl">Results coming up…</p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="w-full max-w-5xl"
    >
      <h1 className="mb-10 text-5xl font-bold text-brand-saffron md:text-6xl">
        {ROUND_TITLE[round] ?? ""} — Results
      </h1>
      <div className="space-y-5">
        {display.map((r, i) => {
          const isWinner = r.id === winnerId;
          return (
            <div key={r.id} className="flex items-center gap-4 text-left">
              <span
                className={`w-64 truncate text-3xl font-semibold md:w-80 md:text-4xl ${
                  isWinner ? "text-brand-gold" : "text-white"
                }`}
              >
                {isWinner && "👑 "}
                {r.name}
              </span>
              <div className="h-12 flex-1 overflow-hidden rounded-xl bg-white/10">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(r.votes / max) * 100}%` }}
                  transition={{
                    delay: i * 0.9,
                    duration: 0.8,
                    ease: "easeOut",
                  }}
                  className={`h-full rounded-xl ${
                    isWinner
                      ? "bg-gradient-to-r from-brand-gold to-brand-saffron"
                      : "bg-brand-saffron/60"
                  }`}
                />
              </div>
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.9 + 0.7 }}
                className="w-24 text-right text-4xl font-bold tabular-nums"
              >
                {r.votes}
              </motion.span>
            </div>
          );
        })}
      </div>
      {winnerId !== null && (
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: revealSeconds + 0.3, duration: 0.6 }}
          className="mt-12 text-6xl font-extrabold text-brand-gold"
        >
          🏆 {sorted[0].name} 🏆
        </motion.p>
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

    // ~4 seconds of cycling random codes, slowing down, then land.
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
      // ease out: 40ms at the start -> ~260ms near the end
      const delay = 40 + 220 * Math.pow(elapsed / duration, 2.2);
      timer = setTimeout(tick, delay);
    };
    tick();
    return () => clearTimeout(timer);
  }, [raffle]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center gap-8"
    >
      <p className="text-4xl tracking-widest text-white/60">🎁 RAFFLE 🎁</p>
      {!raffle && (
        <h1 className="kb-pulse text-6xl font-bold text-brand-gold">
          Get your cards ready…
        </h1>
      )}
      {raffle && (
        <>
          <h1 className="text-6xl font-bold text-brand-saffron md:text-7xl">
            {raffle.prize_name}
          </h1>
          <div className="rounded-3xl border-4 border-brand-gold/60 bg-black/40 px-16 py-10">
            {spinCode && (
              <span className="font-mono text-8xl font-extrabold tabular-nums text-white/80 md:text-9xl">
                {spinCode}
              </span>
            )}
            {landed && (
              <motion.div
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", bounce: 0.5 }}
                className="flex flex-col items-center gap-4"
              >
                <span className="font-mono text-8xl font-extrabold text-brand-gold md:text-9xl">
                  {landed.display_code}
                </span>
                {landed.holder_name && (
                  <span className="text-6xl font-bold text-white">
                    {landed.holder_name}
                  </span>
                )}
              </motion.div>
            )}
            {!spinCode && !landed && (
              <span className="font-mono text-8xl font-extrabold text-white/30">
                KB-????
              </span>
            )}
          </div>
          {landed && (
            <p className="text-4xl text-brand-gold">
              🎉 Come up to the stage! 🎉
            </p>
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
  const pieces = Array.from({ length: 220 }, () => ({
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
