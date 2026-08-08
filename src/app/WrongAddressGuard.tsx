"use client";

import { useEffect, useState } from "react";

// Vercel gives every deployment a throwaway URL (xyz123-team.vercel.app).
// Operating the event from one of those while voters use the real address
// splits the system across deployments. This banner makes that mistake
// impossible to miss, on any page it is mounted on.
export default function WrongAddressGuard() {
  const [wrong, setWrong] = useState<string | null>(null);

  useEffect(() => {
    try {
      const base = process.env.NEXT_PUBLIC_BASE_URL;
      if (!base) return;
      const expected = new URL(base).host;
      const actual = window.location.host;
      if (
        expected &&
        actual !== expected &&
        actual !== "localhost:3000" &&
        expected !== "example.com"
      ) {
        setWrong(expected);
      }
    } catch {
      /* unparseable base url — the system check reports that separately */
    }
  }, []);

  if (!wrong) return null;

  const target = `https://${wrong}${window.location.pathname}`;
  return (
    <div className="fixed inset-x-0 top-0 z-[100] bg-red-600 p-4 text-center shadow-2xl">
      <p className="text-lg font-black text-white">
        ⚠️ WRONG ADDRESS — this is a temporary copy of the site!
      </p>
      <p className="mt-1 text-sm text-red-100">
        Anything you do here will NOT reach the voters or the projector.
      </p>
      <a
        href={target}
        className="mt-2 inline-block rounded-xl bg-white px-6 py-2 font-bold text-red-700"
      >
        → Go to the real site: {wrong}
      </a>
    </div>
  );
}
