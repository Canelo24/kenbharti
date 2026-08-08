"use client";

import { useEffect } from "react";

// Phones (especially iOS Safari) freeze a page's timers the moment the
// user switches away. On return, the page shows stale state until the
// next poll fires. This hook re-syncs IMMEDIATELY whenever the page
// becomes visible/focused again (including bfcache restores), so a
// woken page can never present old data as current.
export function useWakeRefresh(refresh: () => void) {
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const onPageShow = () => refresh();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [refresh]);
}
