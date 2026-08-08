"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { APP_VERSION } from "@/lib/version";

type Round = "rangoli" | "dance";
type Entry = { id: number; name: string; photo_url: string | null };

type VoterState = {
  valid: boolean;
  display_code?: string;
  needs_name?: boolean;
  statuses?: Record<Round, string>;
  voted?: Round[];
  open_round?: Round | null;
  entries?: Entry[];
  logo_url?: string | null;
};

const ROUND_NO: Record<Round, string> = { rangoli: "ROUND 1", dance: "ROUND 2" };
const ROUND_LABEL: Record<Round, string> = {
  rangoli: "Rangoli Competition",
  dance: "Dance Competition",
};
const ROUND_ICON: Record<Round, string> = { rangoli: "🎨", dance: "💃" };

export default function VoterClient({ slug }: { slug: string }) {
  const [state, setState] = useState<VoterState | null>(null);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<Entry | null>(null);
  const [name, setName] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [justVoted, setJustVoted] = useState(false);
  const [voteError, setVoteError] = useState("");
  const stateRef = useRef<VoterState | null>(null);
  stateRef.current = state;

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/voter/${encodeURIComponent(slug)}?t=${Date.now()}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("bad status");
      const data: VoterState = await res.json();
      setState(data);
      setSelected(null);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [slug]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // While waiting, poll the tiny CDN-cached /api/state every 10s and
  // re-fetch the full state only when something changed. Stops for good
  // once this card has voted in both rounds.
  useEffect(() => {
    const id = setInterval(async () => {
      const s = stateRef.current;
      if (!s || !s.valid) return;
      const votedAll =
        s.voted && s.voted.includes("rangoli") && s.voted.includes("dance");
      if (votedAll) return;
      if (s.open_round && !s.voted?.includes(s.open_round)) return;
      try {
        const res = await fetch("/api/state", { cache: "no-store" });
        const fresh = await res.json();
        const cur = stateRef.current?.statuses;
        if (!cur || fresh.rangoli !== cur.rangoli || fresh.dance !== cur.dance) {
          setJustVoted(false);
          refresh();
        }
      } catch {
        /* try again next tick */
      }
    }, 10_000);
    return () => clearInterval(id);
  }, [refresh]);

  async function submitVote() {
    if (!selected || !state?.open_round || submitting) return;
    setSubmitting(true);
    setVoteError("");
    try {
      const res = await fetch("/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          round: state.open_round,
          entry_id: selected.id,
          name: state.needs_name ? name.trim() : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setJustVoted(true);
        setConfirming(false);
        setState((s) =>
          s
            ? {
                ...s,
                needs_name: false,
                voted: [...(s.voted ?? []), s.open_round as Round],
              }
            : s
        );
      } else if (res.status === 409) {
        // Round closed while they were deciding — resync quietly.
        setConfirming(false);
        setVoteError(data.error ?? "Voting has just closed for this round.");
        await refresh();
      } else {
        // NEVER fail silently: show exactly what went wrong, keep the ballot.
        setConfirming(false);
        setVoteError(
          data.error ?? `Something went wrong (code ${res.status}). Your vote was NOT saved — please try again.`
        );
      }
    } catch {
      setConfirming(false);
      setVoteError(
        "Network problem — your vote was NOT saved. Check your signal and try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  // ---------- render ----------

  if (failed && !state) {
    return (
      <Shell>
        <p className="text-lg">Connection problem — retrying…</p>
        <button className="btn-ghost mt-4" onClick={refresh}>
          Try again
        </button>
      </Shell>
    );
  }

  if (!state) {
    return (
      <Shell>
        <Diya />
        <p className="kb-pulse mt-4 text-lg text-white/70">Loading…</p>
      </Shell>
    );
  }

  if (!state.valid) {
    return (
      <Shell>
        <div className="text-5xl">🙏</div>
        <h1 className="mt-4 text-2xl font-bold">This code isn&apos;t valid</h1>
        <p className="mt-2 text-white/60">Please visit the help desk.</p>
      </Shell>
    );
  }

  const openRound = state.open_round;
  const voted = state.voted ?? [];
  const statuses = state.statuses ?? { rangoli: "locked", dance: "locked" };
  const logo = state.logo_url;

  // ---------- BALLOT ----------
  if (openRound && !voted.includes(openRound)) {
    const needName = !!state.needs_name;
    const nameOk = !needName || name.trim().length >= 2;
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#141a3d] via-brand-navy to-[#05070f]">
        <TricolorBar />
        <main className="mx-auto max-w-md px-4 pb-40 pt-4">
          <header className="mb-5">
            <div className="mb-4 flex items-center justify-between">
              <Logo logo={logo} size="sm" />
              <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 font-mono text-xs text-white/70">
                🎟️ {state.display_code}
              </span>
            </div>
            <div className="rounded-2xl border border-brand-saffron/30 bg-gradient-to-r from-brand-saffron/15 to-brand-gold/5 p-4 text-center shadow-lg">
              <p className="text-xs font-black uppercase tracking-[0.3em] text-brand-gold">
                {ROUND_NO[openRound]} · voting open
              </p>
              <h1 className="mt-1 text-3xl font-extrabold">
                {ROUND_ICON[openRound]} {ROUND_LABEL[openRound]}
              </h1>
              <p className="mt-1 text-sm text-white/60">
                Tap your favourite, then confirm. One vote — final.
              </p>
            </div>
            {voteError && (
              <div className="mt-3 rounded-2xl border border-red-500/50 bg-red-500/15 p-4 text-center">
                <p className="font-bold text-red-300">⚠️ Vote not saved</p>
                <p className="mt-1 text-sm text-red-200/90">{voteError}</p>
              </div>
            )}
          </header>

          <div className="grid grid-cols-2 gap-3">
            {(state.entries ?? []).map((e, i) => {
              const isSel = selected?.id === e.id;
              return (
                <button
                  key={e.id}
                  onClick={() => setSelected(e)}
                  className={`relative overflow-hidden rounded-2xl border text-left transition-all duration-150 ${
                    isSel
                      ? "scale-[1.02] border-brand-saffron bg-brand-saffron/10 shadow-xl shadow-amber-500/20 ring-2 ring-brand-saffron"
                      : "border-white/10 bg-white/5 active:scale-95"
                  }`}
                >
                  {e.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={e.photo_url}
                      alt={e.name}
                      loading="lazy"
                      className="aspect-square w-full object-cover"
                    />
                  ) : (
                    <div className="flex aspect-square w-full items-center justify-center bg-gradient-to-br from-white/10 to-white/5 text-5xl">
                      {ROUND_ICON[openRound]}
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-1 p-3">
                    <span className="truncate text-sm font-bold">{e.name}</span>
                    <span
                      className={`flex h-6 w-6 flex-none items-center justify-center rounded-full border-2 text-xs font-black transition ${
                        isSel
                          ? "border-brand-saffron bg-brand-saffron text-brand-navy"
                          : "border-white/25 text-transparent"
                      }`}
                    >
                      ✓
                    </span>
                  </div>
                  {isSel && (
                    <span className="absolute left-2 top-2 rounded-full bg-brand-saffron px-2 py-0.5 text-[10px] font-black uppercase text-brand-navy shadow">
                      Your pick
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Sticky confirm bar */}
          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#0a0f24]/95 px-4 pb-6 pt-4 backdrop-blur-md">
            <div className="mx-auto max-w-md">
              {needName && selected && (
                <input
                  className="input mb-3"
                  placeholder="Your full name — needed for the raffle 🎁"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                />
              )}
              <button
                className="btn-primary w-full py-4 text-lg"
                disabled={!selected || !nameOk}
                onClick={() => setConfirming(true)}
              >
                {!selected
                  ? "👆 Select an entry above"
                  : !nameOk
                    ? "Enter your name to continue"
                    : `Vote for ${selected.name} →`}
              </button>
            </div>
          </div>

          {confirming && selected && (
            <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-4 backdrop-blur-sm sm:items-center">
              <div className="w-full max-w-md rounded-3xl border border-brand-saffron/40 bg-gradient-to-b from-[#1a2148] to-brand-navy p-6 shadow-2xl">
                <p className="text-center text-4xl">{ROUND_ICON[openRound]}</p>
                <h2 className="mt-2 text-center text-2xl font-extrabold">
                  Vote for {selected.name}?
                </h2>
                <p className="mt-2 text-center text-sm text-white/60">
                  {ROUND_NO[openRound]} · {ROUND_LABEL[openRound]}
                  <br />
                  <b className="text-white/80">This cannot be changed.</b> Votes are final.
                </p>
                <div className="mt-6 flex gap-3">
                  <button
                    className="btn-ghost flex-1"
                    onClick={() => setConfirming(false)}
                    disabled={submitting}
                  >
                    ← Go back
                  </button>
                  <button
                    className="btn-primary flex-1"
                    onClick={submitVote}
                    disabled={submitting}
                  >
                    {submitting ? "Sending…" : "Confirm ✓"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    );
  }

  // ---------- RECEIPT ----------
  if ((openRound && voted.includes(openRound)) || justVoted) {
    return (
      <Shell logo={logo} code={state.display_code}>
        <div className="flex h-24 w-24 animate-[kb-pop_0.5s_ease-out] items-center justify-center rounded-full bg-gradient-to-b from-green-400 to-green-600 text-5xl shadow-2xl shadow-green-500/40">
          ✓
        </div>
        <h1 className="mt-5 text-3xl font-extrabold">Vote received!</h1>
        {openRound && (
          <p className="mt-1 text-sm text-white/50">
            {ROUND_NO[openRound]} · {ROUND_LABEL[openRound]}
          </p>
        )}
        <div className="mt-5 rounded-2xl border border-brand-gold/30 bg-brand-gold/10 px-6 py-4">
          <p className="text-lg font-bold text-brand-gold">
            🎁 You&apos;re in the raffle draw!
          </p>
          <p className="mt-1 text-xs text-white/60">
            Keep your card safe — winners are announced on the big screen.
          </p>
        </div>
        <p className="mt-6 text-sm text-white/40">
          This page updates automatically when the next round opens.
        </p>
      </Shell>
    );
  }

  // ---------- ALL DONE ----------
  if (voted.includes("rangoli") && voted.includes("dance")) {
    return (
      <Shell logo={logo} code={state.display_code}>
        <div className="text-6xl">🎉</div>
        <h1 className="mt-4 text-3xl font-extrabold">All votes cast!</h1>
        <div className="mt-5 rounded-2xl border border-brand-gold/30 bg-brand-gold/10 px-6 py-4">
          <p className="text-lg font-bold text-brand-gold">
            🎁 You&apos;re in the raffle draw!
          </p>
          <p className="mt-1 text-xs text-white/60">
            Good luck — eyes on the big screen.
          </p>
        </div>
      </Shell>
    );
  }

  // ---------- CLOSED / WAITING ----------
  const anyStarted = Object.values(statuses).some((s) => s !== "locked");
  if (anyStarted) {
    return (
      <Shell logo={logo} code={state.display_code}>
        <div className="text-6xl">📺</div>
        <h1 className="mt-4 text-3xl font-extrabold">Voting closed</h1>
        <p className="mt-2 text-lg text-white/70">Eyes on the big screen!</p>
        <p className="kb-pulse mt-6 text-sm text-white/40">
          This page updates automatically when the next round opens.
        </p>
      </Shell>
    );
  }

  // ---------- WELCOME ----------
  return (
    <Shell logo={logo} code={state.display_code}>
      <h1 className="bg-gradient-to-r from-brand-saffron via-white to-brand-green bg-clip-text text-4xl font-extrabold text-transparent">
        Maa Tujhe Salaam
      </h1>
      <p className="mt-1 text-sm uppercase tracking-[0.3em] text-white/40">
        Kenbharti Centre · Nairobi
      </p>
      <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 px-6 py-5">
        <p className="text-lg font-semibold">Welcome! 🙏</p>
        <p className="kb-pulse mt-2 text-white/60">
          Voting opens soon — keep this page open.
        </p>
      </div>
    </Shell>
  );
}

// ---------- shared pieces ----------

function TricolorBar() {
  return (
    <div className="flex h-1.5 w-full">
      <div className="flex-1 bg-brand-saffron" />
      <div className="flex-1 bg-white" />
      <div className="flex-1 bg-brand-green" />
      <div className="flex-1 bg-black" />
      <div className="flex-1 bg-red-600" />
    </div>
  );
}

function Logo({ logo, size = "lg" }: { logo?: string | null; size?: "sm" | "lg" }) {
  const cls = size === "lg" ? "h-28" : "h-12";
  if (logo) {
    return (
      <div className={`${cls} flex items-center`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} alt="Kenbharti" className="h-full w-auto drop-shadow-xl" />
      </div>
    );
  }
  return <div className={size === "lg" ? "text-6xl" : "text-3xl"}>🦋</div>;
}

function Diya() {
  return <div className="text-5xl">🪔</div>;
}

function Shell({
  children,
  logo,
  code,
}: {
  children: React.ReactNode;
  logo?: string | null;
  code?: string;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#141a3d] via-brand-navy to-[#05070f]">
      <TricolorBar />
      <main className="mx-auto flex min-h-[calc(100vh-6px)] max-w-md flex-col items-center justify-center p-6 text-center">
        {(logo || code) && (
          <div className="mb-6 flex flex-col items-center gap-3">
            <Logo logo={logo} />
            {code && (
              <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 font-mono text-xs text-white/60">
                🎟️ {code}
              </span>
            )}
          </div>
        )}
        {children}
        <p className="mt-10 text-[10px] text-white/25">
          Kenbharti Centre (Nairobi) · {APP_VERSION}
        </p>
      </main>
    </div>
  );
}
