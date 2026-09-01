"use client";

import { useEffect, useRef, useState } from "react";
import { createGameCompleteEvent, trackEvent } from "../../lib/analytics";
import { getUtcDateKey } from "../../lib/daily";
import { submitLeaderboardScore } from "../../lib/leaderboard-client";
import { completeGame } from "../../lib/stats";
import { lsGet, lsSet } from "../../lib/storage";
import {
  buildDelaySequence,
  computeAverage,
  computeResult,
  FALSE_START_PENALTY_MS,
  REACTION_TEST_SLUG,
  ROUNDS,
  WIN_THRESHOLD_MS,
  type RoundResult,
} from "./reaction-core";

type Phase = "start" | "waiting" | "go" | "result" | "complete";

type SavedProgress = {
  results: RoundResult[];
  completed: boolean;
};

function getProgressKey(dateKey: string): string {
  return `dgh:${REACTION_TEST_SLUG}:${dateKey}`;
}

function loadProgress(dateKey: string): SavedProgress | null {
  if (typeof window === "undefined") return null;
  const raw = lsGet(getProgressKey(dateKey));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SavedProgress;
  } catch {
    return null;
  }
}

function saveProgress(dateKey: string, progress: SavedProgress): void {
  if (typeof window === "undefined") return;
  lsSet(getProgressKey(dateKey), JSON.stringify(progress));
}

export function ReactionTestGame({ initialDateKey }: { initialDateKey: string }) {
  const [dateKey, setDateKey] = useState("");
  const [delays, setDelays] = useState<number[]>([]);
  const [phase, setPhase] = useState<Phase>("start");
  const [results, setResults] = useState<RoundResult[]>([]);
  const [lastRoundMs, setLastRoundMs] = useState<number | null>(null);
  const [lastFalseStart, setLastFalseStart] = useState(false);
  const [ready, setReady] = useState(false);

  const started = useRef(false);
  const waitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const goAt = useRef(0);
  const roundToken = useRef(0);

  useEffect(() => {
    const today = getUtcDateKey();
    const seq = buildDelaySequence(today);
    const saved = loadProgress(today);

    setDateKey(today);
    setDelays(seq);

    if (saved) {
      setResults(saved.results);
      if (saved.completed) {
        setPhase("complete");
      }
    }

    setReady(true);

    return () => {
      if (waitTimer.current) clearTimeout(waitTimer.current);
    };
  }, []);

  const finalize = (finalResults: RoundResult[], today: string) => {
    const result = computeResult(finalResults);
    completeGame(REACTION_TEST_SLUG, result, today);
    trackEvent(createGameCompleteEvent(REACTION_TEST_SLUG, today, result));
    saveProgress(today, { results: finalResults, completed: true });
    void submitLeaderboardScore(REACTION_TEST_SLUG, today, computeAverage(finalResults));
  };

  const recordRound = (round: RoundResult) => {
    setResults((prev) => {
      const newResults = [...prev, round];

      if (newResults.length >= ROUNDS) {
        finalize(newResults, dateKey);
        setPhase("complete");
      } else {
        saveProgress(dateKey, { results: newResults, completed: false });
        setLastRoundMs(round.falseStart ? null : round.ms);
        setLastFalseStart(round.falseStart);
        setPhase("result");
      }

      return newResults;
    });
  };

  const startRound = (roundIdx: number) => {
    const token = (roundToken.current += 1);
    setPhase("waiting");
    const delay = delays[roundIdx] ?? 2000;

    waitTimer.current = setTimeout(() => {
      if (roundToken.current !== token) return;
      goAt.current = performance.now();
      setPhase("go");
    }, delay);
  };

  const handleAdvance = () => {
    if (!ready || !dateKey) return;
    if (!started.current) {
      started.current = true;
      trackEvent({ name: "game_start", slug: REACTION_TEST_SLUG, dateKey });
    }
    startRound(results.length);
  };

  const handleWaitingClick = () => {
    if (waitTimer.current) {
      clearTimeout(waitTimer.current);
      waitTimer.current = null;
    }
    // Invalidate any in-flight timeout so a race with the "go" transition
    // can't fire after this false start has already been recorded.
    roundToken.current += 1;
    recordRound({ ms: FALSE_START_PENALTY_MS, falseStart: true });
  };

  const handleGoClick = () => {
    const reactionMs = Math.round(performance.now() - goAt.current);
    recordRound({ ms: reactionMs, falseStart: false });
  };

  const handleBoxClick = () => {
    if (!ready) return;
    if (phase === "start" || phase === "result") {
      handleAdvance();
    } else if (phase === "waiting") {
      handleWaitingClick();
    } else if (phase === "go") {
      handleGoClick();
    }
  };

  if (!ready) {
    return (
      <section aria-label="Daily Reaction Test" className="mx-auto max-w-sm py-10 text-center">
        <p className="font-sans text-subtle-foreground">Loading…</p>
      </section>
    );
  }

  if (phase === "complete") {
    const average = computeAverage(results);
    const isWin = average <= WIN_THRESHOLD_MS;

    return (
      <section aria-label="Daily Reaction Test Results" className="mx-auto max-w-sm">
        <header className="mb-4 flex items-baseline justify-between">
          <h2 className="font-display text-lg font-semibold text-foreground">Reaction Test</h2>
          <time dateTime={dateKey || initialDateKey} className="font-sans text-xs text-subtle-foreground">
            {dateKey || initialDateKey} (UTC)
          </time>
        </header>

        <div className="rounded-lg bg-subtle p-6 text-center">
          <p className="font-sans text-sm text-subtle-foreground">Your average reaction time</p>
          <p className="font-display text-4xl font-bold text-foreground">{average}ms</p>
          <p className="mt-2 font-sans text-sm font-medium text-foreground">
            {isWin ? "Great reflexes today!" : "Better luck tomorrow!"}
          </p>
        </div>

        <div className="mt-4 grid grid-cols-5 gap-2" aria-label="Round breakdown">
          {results.map((r, i) => (
            <div
              key={i}
              className={`rounded-md p-2 text-center font-sans text-xs ${
                r.falseStart
                  ? "bg-red-500/15 text-red-500"
                  : "bg-green-500/15 text-green-600 dark:text-green-400"
              }`}
              title={r.falseStart ? "False start" : `${r.ms}ms`}
            >
              <div className="text-[10px] uppercase tracking-wide text-subtle-foreground">
                R{i + 1}
              </div>
              <div className="font-medium">{r.falseStart ? "—" : `${r.ms}ms`}</div>
            </div>
          ))}
        </div>

        <p className="mt-4 text-center font-sans text-xs text-subtle-foreground">
          Come back tomorrow for a new set of rounds!
        </p>
      </section>
    );
  }

  const roundNumber = Math.min(results.length + 1, ROUNDS);

  let boxLabel: string;
  let boxSubLabel: string | null = null;
  let boxClasses: string;

  if (phase === "start") {
    boxLabel = results.length === 0 ? "Click to Start" : "Click to Continue";
    boxSubLabel = "Wait for the box to turn green, then click as fast as you can.";
    boxClasses = "bg-subtle text-subtle-foreground";
  } else if (phase === "waiting") {
    boxLabel = "Wait for green…";
    boxSubLabel = "Don't click yet!";
    boxClasses = "bg-red-500 text-white";
  } else if (phase === "go") {
    boxLabel = "Click now!";
    boxClasses = "bg-green-500 text-white";
  } else {
    // phase === "result"
    boxLabel = lastFalseStart ? "Too soon!" : `${lastRoundMs}ms`;
    boxSubLabel = lastFalseStart
      ? `Recorded as ${FALSE_START_PENALTY_MS}ms — click to continue`
      : "Click to continue";
    boxClasses = lastFalseStart
      ? "bg-red-500/80 text-white"
      : "bg-primary text-primary-foreground";
  }

  return (
    <section aria-label="Daily Reaction Test" className="mx-auto max-w-sm">
      <header className="mb-4 flex items-baseline justify-between">
        <h2 className="font-display text-lg font-semibold text-foreground">Reaction Test</h2>
        <time dateTime={dateKey || initialDateKey} className="font-sans text-xs text-subtle-foreground">
          {dateKey || initialDateKey} (UTC)
        </time>
      </header>

      <p className="mb-3 text-center font-sans text-sm text-subtle-foreground">
        Round {roundNumber} / {ROUNDS}
      </p>

      <button
        type="button"
        onClick={handleBoxClick}
        className={`flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-xl p-6 text-center font-sans transition-colors duration-150 ${boxClasses}`}
        aria-live="polite"
      >
        <span className="font-display text-2xl font-semibold">{boxLabel}</span>
        {boxSubLabel && <span className="text-sm opacity-90">{boxSubLabel}</span>}
      </button>

      {results.length > 0 && phase !== "go" && phase !== "waiting" && (
        <div className="mt-4 grid grid-cols-5 gap-2" aria-label="Rounds so far">
          {Array.from({ length: ROUNDS }).map((_, i) => {
            const r = results[i];
            return (
              <div
                key={i}
                className={`rounded-md p-2 text-center font-sans text-xs ${
                  !r
                    ? "bg-subtle text-subtle-foreground/50"
                    : r.falseStart
                      ? "bg-red-500/15 text-red-500"
                      : "bg-green-500/15 text-green-600 dark:text-green-400"
                }`}
              >
                <div className="text-[10px] uppercase tracking-wide text-subtle-foreground">
                  R{i + 1}
                </div>
                <div className="font-medium">{r ? (r.falseStart ? "—" : `${r.ms}ms`) : ""}</div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
