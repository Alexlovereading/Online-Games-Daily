"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getUtcDateKey } from "@/lib/daily";
import {
  fetchDailyLeaderboard,
  fetchAllTimeLeaderboard,
  getPlayerName,
  setPlayerName,
  LEADERBOARD_SUBMITTED_EVENT,
  type LeaderboardEntry,
  type LeaderboardSubmittedDetail,
} from "@/lib/leaderboard-client";
import { getLeaderboardConfig, formatMetricValue } from "@/lib/leaderboard-config";

type LeaderboardProps = {
  /** Leaderboard key from lib/leaderboard-config.ts (usually the game slug). */
  slug: string;
  dateKey: string;
};

const tabButtonClass = (active: boolean) =>
  `rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors ${
    active ? "bg-primary text-primary-foreground" : "text-subtle-foreground hover:bg-subtle hover:text-foreground"
  }`;

export function Leaderboard({ slug, dateKey: initialDateKeyProp }: LeaderboardProps) {
  const cfg = getLeaderboardConfig(slug);
  const [tab, setTab] = useState<"daily" | "alltime">("daily");
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [nameError, setNameError] = useState(false);
  // `dateKey` arrives as a prop that may have been frozen at build time
  // (GameLayout computes it server-side, and the site's only rebuild
  // trigger is a daily scheduled deploy that can run late or fail — see
  // .github/workflows/daily-rebuild.yml). Re-verify against the browser's
  // real clock on mount so the "Today" tab never queries the wrong UTC day.
  const [dateKey, setDateKey] = useState(initialDateKeyProp);

  useEffect(() => {
    const real = getUtcDateKey();
    if (real !== initialDateKeyProp) setDateKey(real);
  }, [initialDateKeyProp]);

  useEffect(() => {
    const current = getPlayerName();
    setName(current);
    setNameInput(current);
  }, []);

  // Shared fetch path for both the tab/date-driven refresh below and the
  // submission-event-driven refresh — guarded by a single monotonically
  // increasing request id so that whichever fetch was issued LAST is the
  // only one allowed to apply its result, regardless of which effect
  // triggered it or the order the network responses actually arrive in.
  const requestIdRef = useRef(0);

  const refresh = useCallback(
    (currentTab: "daily" | "alltime", currentDateKey: string) => {
      const requestId = ++requestIdRef.current;
      setLoading(true);
      const fetcher =
        currentTab === "daily" ? fetchDailyLeaderboard(slug, currentDateKey) : fetchAllTimeLeaderboard(slug);
      fetcher.then((res) => {
        if (requestIdRef.current !== requestId) return; // superseded by a newer request
        setEntries(res?.entries ?? []);
        setLoading(false);
      });
    },
    [slug]
  );

  useEffect(() => {
    refresh(tab, dateKey);
  }, [slug, dateKey, tab, refresh]);

  // Refetch whenever this game just accepted a new submission (dispatched
  // by submitLeaderboardScore) — otherwise a player who just finished
  // today's puzzle sees their old list until they manually reload or
  // switch tabs and back.
  useEffect(() => {
    const onSubmitted = (event: Event) => {
      const detail = (event as CustomEvent<LeaderboardSubmittedDetail>).detail;
      if (!detail || detail.slug !== slug) return;
      refresh(tab, dateKey);
    };
    window.addEventListener(LEADERBOARD_SUBMITTED_EVENT, onSubmitted);
    return () => window.removeEventListener(LEADERBOARD_SUBMITTED_EVENT, onSubmitted);
  }, [slug, dateKey, tab, refresh]);

  if (!cfg) return null;

  const saveName = () => {
    const ok = setPlayerName(nameInput);
    if (!ok) {
      setNameError(true);
      return;
    }
    setNameError(false);
    setName(nameInput.trim().slice(0, 24));
    setEditingName(false);
  };

  return (
    <section
      className="mx-auto mt-8 w-full max-w-[720px] rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6"
      aria-label={`${cfg.title} leaderboard`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold text-foreground">Leaderboard</h2>
        <div role="tablist" aria-label="Leaderboard range" className="flex gap-1 rounded-lg border border-border bg-subtle p-1">
          <button type="button" role="tab" aria-selected={tab === "daily"} className={tabButtonClass(tab === "daily")} onClick={() => setTab("daily")}>
            Today
          </button>
          <button type="button" role="tab" aria-selected={tab === "alltime"} className={tabButtonClass(tab === "alltime")} onClick={() => setTab("alltime")}>
            All-time
          </button>
        </div>
      </div>

      <p className="mt-3 text-xs text-subtle-foreground">
        Ranked by {cfg.metricLabel.toLowerCase()} ({cfg.direction === "higher_is_better" ? "higher is better" : "lower is better"}).
      </p>

      <div className="mt-3 flex flex-col gap-1.5 text-sm text-subtle-foreground">
        {editingName ? (
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              saveName();
            }}
          >
            <input
              value={nameInput}
              onChange={(e) => {
                setNameInput(e.target.value);
                if (nameError) setNameError(false);
              }}
              maxLength={24}
              aria-label="Your leaderboard name"
              aria-invalid={nameError}
              className="rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
              autoFocus
            />
            <button type="submit" className="rounded-md bg-primary px-2 py-1 text-xs font-bold text-primary-foreground">
              Save
            </button>
            {nameError && (
              <span role="alert" className="text-xs text-red-500">
                That name isn&apos;t allowed — try something else.
              </span>
            )}
          </form>
        ) : (
          <>
            <span>
              Playing as <strong className="text-foreground">{name}</strong>
            </span>
            <button
              type="button"
              onClick={() => setEditingName(true)}
              className="text-link underline underline-offset-2 transition-colors hover:text-foreground"
            >
              Change name
            </button>
          </>
        )}
      </div>

      <div className="mt-4">
        {loading && <p className="py-6 text-center text-sm text-subtle-foreground">Loading…</p>}
        {!loading && entries && entries.length === 0 && (
          <p className="py-6 text-center text-sm text-subtle-foreground">
            {tab === "daily" ? "No scores yet today — be the first." : "No scores yet."}
          </p>
        )}
        {!loading && entries && entries.length > 0 && (
          <ol className="flex flex-col divide-y divide-border">
            {entries.map((e) => (
              <li
                key={`${e.rank}-${e.playerName}`}
                className={`flex items-center gap-3 py-2 text-sm ${e.playerName === name ? "font-bold text-foreground" : "text-subtle-foreground"}`}
              >
                <span className="w-8 shrink-0 text-right tabular-nums">#{e.rank}</span>
                <span className="min-w-0 flex-1 truncate">{e.playerName}</span>
                <span className="shrink-0 tabular-nums">{formatMetricValue(cfg, e.value)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
