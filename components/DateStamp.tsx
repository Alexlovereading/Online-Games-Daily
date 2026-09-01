"use client";

import { useEffect, useState } from "react";
import { getUtcDateKey } from "@/lib/daily";

type DateStampProps = {
  /** Computed server-side (build time) so the static HTML always ships a real date. */
  initialDateKey: string;
};

export function DateStamp({ initialDateKey }: DateStampProps) {
  const [dateKey, setDateKey] = useState(initialDateKey);

  useEffect(() => {
    // Re-syncs client-side in case the visitor loads a stale static build
    // after a UTC day rollover since the last deploy.
    const liveDateKey = getUtcDateKey();
    if (liveDateKey !== dateKey) {
      setDateKey(liveDateKey);
    }
  }, [dateKey]);

  return (
    <p className="date-stamp" aria-live="polite">
      Today&apos;s puzzle <span aria-hidden="true">·</span>{" "}
      <time dateTime={dateKey}>{dateKey}</time> (UTC)
    </p>
  );
}
