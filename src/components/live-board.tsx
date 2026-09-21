"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const POLL_MS = 30000;

/**
 * Polls the server every 30s and shows "Updated Xs ago". `renderedAt` must
 * be a fresh `Date.now()` computed by the server component on each render,
 * so the counter resets exactly when new data actually arrives (not on
 * every local re-render, e.g. from its own ticking).
 */
export function LiveBoard({ children, renderedAt }: { children: React.ReactNode; renderedAt: number }) {
  const router = useRouter();
  const [secondsAgo, setSecondsAgo] = useState(0);

  useEffect(() => {
    const pollId = setInterval(() => router.refresh(), POLL_MS);
    return () => clearInterval(pollId);
  }, [router]);

  useEffect(() => {
    setSecondsAgo(0);
    const tickId = setInterval(() => setSecondsAgo((s) => s + 1), 1000);
    return () => clearInterval(tickId);
  }, [renderedAt]);

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <p className="text-xs text-muted">
          {secondsAgo < 3 ? "Updated just now" : `Updated ${secondsAgo}s ago`}
        </p>
      </div>
      {children}
    </div>
  );
}
