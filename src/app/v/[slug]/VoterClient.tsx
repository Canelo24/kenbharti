"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
};

const ROUND_LABEL: Record<Round, string> = {
  rangoli: "Rangoli Competition",
  dance: "Dance Competition",
};

export default function VoterClient({ slug }: { slug: string }) {
  const [state, setState] = useState<VoterState | null>(null);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<Entry | null>(null);
  const [name, setName] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [justVoted, setJustVoted] = useState(false);
  const stateRef = useRef<VoterState | null>(null);
  stateRef.current = state;

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/voter/${encodeURIComponent(slug)}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("bad status");
      const data: VoterState = await res.json();
      setState(data);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [slug]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Waiting behaviour: poll the tiny CDN-cached /api/state every 10s.
  // When statuses change, re-fetch the full voter state once.
  // Polling stops for good once this token has voted in both rounds.
  useEffect(() => {
    const id = setInterval(async () => {
      const s = stateRef.current;
      if (!s || !s.valid) return;
      const votedAll =
        s.voted && s.voted.includes("rangoli") && s.voted.includes("dance");
      if (votedAll) return;
      // While the ballot is on screen there is nothing to poll for.
      if (s.open_round && !s.voted?.includes(s.open_round)) return;
      try {
        const res = await fetch("/api/state", { cache: "no-store" });
        const fresh = await res.json();
        const cur = stateRef.current?.statuses;
        if (
          !cur ||
          fresh.rangoli !== cur.rangoli ||
          fresh.dance !== cur.dance
        ) {
          refresh();
        }
      } catch {
        /* network blip — try again next tick */
      }
    }, 10_000);
    return () => clearInterval(id);
  }, [refresh]);

  async function submitVote() {
    if (!selected || !state?.open_round || submitting) return;
    setSubmitting(true);
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
      const data = await res.json();
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
      } else {
        // Round probably closed while they were deciding — resync.
        setConfirming(false);
        await refresh();
      }
    } catch {
      setConfirming(false);
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
        <p className="kb-pulse text-lg">Loading…</p>
      </Shell>
    );
  }

  if (!state.valid) {
    return (
      <Shell>
        <div className="text-4xl">🙏</div>
        <h1 className="mt-3 text-xl font-bold">
          This code isn&apos;t valid
        </h1>
        <p className="mt-2 text-white/70">Please see the help desk.</p>
      </Shell>
    );
  }

  const openRound = state.open_round;
  const voted = state.voted ?? [];
  const statuses = state.statuses ?? { rangoli: "locked", dance: "locked" };

  // Ballot: a round is open and this token hasn't voted in it
  if (openRound && !voted.includes(openRound)) {
    const needName = !!state.needs_name;
    const nameOk = !needName || name.trim().length >= 2;
    return (
      <main className="mx-auto min-h-screen max-w-md p-4 pb-32">
        <header className="mb-4 text-center">
          <p className="text-sm uppercase tracking-widest text-brand-gold">
            Maa Tujhe Salaam
          </p>
          <h1 className="text-2xl font-bold">{ROUND_LABEL[openRound]}</h1>
          <p className="mt-1 text-white/70">Tap your favourite, then confirm.</p>
        </header>

        <div className="grid grid-cols-2 gap-3">
          {(state.entries ?? []).map((e) => (
            <button
              key={e.id}
              onClick={() => setSelected(e)}
              className={`card overflow-hidden p-0 text-left transition ${
                selected?.id === e.id
                  ? "border-brand-saffron ring-2 ring-brand-saffron"
                  : ""
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
                <div className="flex aspect-square w-full items-center justify-center bg-white/10 text-4xl">
                  {openRound === "rangoli" ? "🎨" : "💃"}
                </div>
              )}
              <div className="flex items-center justify-between p-3">
                <span className="font-semibold">{e.name}</span>
                {selected?.id === e.id && (
                  <span className="text-brand-saffron">●</span>
                )}
              </div>
            </button>
          ))}
        </div>

        <div className="fixed inset-x-0 bottom-0 border-t border-white/10 bg-brand-navy/95 p-4 backdrop-blur">
          <div className="mx-auto max-w-md">
            {needName && selected && (
              <input
                className="input mb-3"
                placeholder="Your full name (for the raffle draw)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
            )}
            <button
              className="btn-primary w-full text-lg"
              disabled={!selected || !nameOk}
              onClick={() => setConfirming(true)}
            >
              {selected ? `Vote for ${selected.name}` : "Select an entry above"}
            </button>
          </div>
        </div>

        {confirming && selected && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
            <div className="card w-full max-w-md border-brand-saffron/50 bg-brand-navy p-6">
              <h2 className="text-xl font-bold">
                Confirm vote for {selected.name}
              </h2>
              <p className="mt-2 text-white/70">
                This cannot be changed. Votes are final.
              </p>
              <div className="mt-5 flex gap-3">
                <button
                  className="btn-ghost flex-1"
                  onClick={() => setConfirming(false)}
                  disabled={submitting}
                >
                  Go back
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
    );
  }

  // Receipt: voted in the currently open round (or just voted)
  if ((openRound && voted.includes(openRound)) || justVoted) {
    return (
      <Shell>
        <div className="text-6xl">✅</div>
        <h1 className="mt-4 text-2xl font-bold">Vote received</h1>
        <p className="mt-2 text-lg text-brand-gold">
          You&apos;re in the raffle draw! 🎁
        </p>
        <p className="mt-4 text-white/60">
          Keep your card safe and watch the big screen.
        </p>
      </Shell>
    );
  }

  // Voted in both rounds — all done
  if (voted.includes("rangoli") && voted.includes("dance")) {
    return (
      <Shell>
        <div className="text-6xl">🎁</div>
        <h1 className="mt-4 text-2xl font-bold">All votes cast — thank you!</h1>
        <p className="mt-2 text-brand-gold">You&apos;re in the raffle draw!</p>
        <p className="mt-4 text-white/60">Good luck — watch the big screen.</p>
      </Shell>
    );
  }

  // A round was closed/revealed and nothing is open
  const anyStarted = Object.values(statuses).some((s) => s !== "locked");
  if (anyStarted) {
    return (
      <Shell>
        <div className="text-6xl">📺</div>
        <h1 className="mt-4 text-2xl font-bold">Voting closed</h1>
        <p className="mt-2 text-white/70">Eyes on the big screen!</p>
        <p className="mt-4 text-sm text-white/40">
          This page updates automatically when the next round opens.
        </p>
      </Shell>
    );
  }

  // Pre-event welcome
  return (
    <Shell>
      <div className="text-5xl">🇮🇳 🇰🇪</div>
      <h1 className="mt-4 text-2xl font-bold text-brand-saffron">
        Maa Tujhe Salaam
      </h1>
      <p className="mt-2 text-lg">Welcome, {state.display_code}!</p>
      <p className="kb-pulse mt-4 text-white/70">
        Voting opens soon — keep this page open.
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center p-6 text-center">
      {children}
    </main>
  );
}
