"use client";

import { useEffect } from "react";
import { millisecondsUntilNextUtcDay } from "@/lib/daily";

const ROLLOVER_BUFFER_MS = 100;

export function UtcDayRollover() {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      window.location.reload();
    }, millisecondsUntilNextUtcDay() + ROLLOVER_BUFFER_MS);

    return () => window.clearTimeout(timer);
  }, []);

  return null;
}
