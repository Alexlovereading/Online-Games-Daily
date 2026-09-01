"use client";

/**
 * Game state adapted from emanuelecaurio/react-card-memory-game (MIT)
 * commit f08a45a55dd0665639a986d25112f8b57d26e85e
 * Original: src/MemoryGame.tsx — cardStatuses array, click guards,
 *   match-checker useEffect, win-detector useEffect, and result callbacks.
 *   reactjs-flip-card replaced by local Card.tsx.
 *   Math.random shuffle replaced by makeSeededRng(getDailySeed(dateKey, slug)).
 *   Added: moves counter, useTimer, localStorage progress, daily framework integration.
 *
 * Copyright (c) 2022 Emanuele Caurio
 */

import { useEffect, useRef, useState } from "react";
import { createGameCompleteEvent, trackEvent } from "../../lib/analytics";
import { getDailySeed, getUtcDateKey, makeReplayKey, makeSeededRng } from "../../lib/daily";
import { submitLeaderboardScore } from "../../lib/leaderboard-client";
import { completeGame } from "../../lib/stats";
import { lsGet, lsSet } from "../../lib/storage";
import { Card } from "./Card";
import { CardStatus, cardStatuses } from "./consts";
import { getGeneratedGrid } from "./getGeneratedGrid";
import { useTimer } from "./useTimer";

export const MEMORY_GAME_SLUG = "memory-game";

type SavedProgress = {
  completed: boolean;
  moves: number;
  elapsed: number;
};

function getProgressKey(dateKey: string): string {
  return `dgh:memory-game:${dateKey}`;
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

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function MemoryGame({ initialDateKey }: { initialDateKey: string }) {
  const [dateKey, setDateKey] = useState("");
  const [grid, setGrid] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<CardStatus[]>([]);
  const [firstClicked, setFirstClicked] = useState<number | null>(null);
  const [moves, setMoves] = useState(0);
  const [phase, setPhase] = useState<"playing" | "won">("playing");
  const [ready, setReady] = useState(false);
  const [savedElapsed, setSavedElapsed] = useState<number | null>(null);
  const [replayKey, setReplayKey] = useState<string | null>(null);

  // Stale-closure guard: keep a ref to the latest statuses for use in timeouts
  const statusesRef = useRef<CardStatus[]>([]);
  const firstClickedRef = useRef<number | null>(null);
  const matchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dateKeyRef = useRef("");
  const gridRef = useRef<string[]>([]);

  const elapsed = useTimer(phase === "playing" && ready && moves > 0);

  useEffect(() => {
    statusesRef.current = statuses;
  }, [statuses]);

  useEffect(() => {
    firstClickedRef.current = firstClicked;
  }, [firstClicked]);

  // Hydration: build grid and restore progress
  useEffect(() => {
    const today = getUtcDateKey();
    const seed = getDailySeed(today, MEMORY_GAME_SLUG);
    const rng = makeSeededRng(seed);
    const generatedGrid = getGeneratedGrid(rng);
    const saved = loadProgress(today);

    dateKeyRef.current = today;
    gridRef.current = generatedGrid;
    setDateKey(today);
    setGrid(generatedGrid);

    if (saved?.completed) {
      // Restore completed state — show all cards face up
      setStatuses(generatedGrid.map(() => cardStatuses.discovered));
      setMoves(saved.moves);
      setSavedElapsed(saved.elapsed);
      setPhase("won");
    } else {
      setStatuses(generatedGrid.map(() => cardStatuses.hole));
    }

    setReady(true);

    return () => {
      if (matchTimerRef.current) clearTimeout(matchTimerRef.current);
    };
  }, []);

  const resetGame = () => {
    if (matchTimerRef.current) clearTimeout(matchTimerRef.current);
    // Today's real result stays in localStorage untouched — a replay round
    // never persists, so refreshing mid-replay lands back on today's result.
    const newKey = makeReplayKey();
    setReplayKey(newKey);
    const newGrid = getGeneratedGrid(makeSeededRng(getDailySeed(newKey, MEMORY_GAME_SLUG)));
    gridRef.current = newGrid;
    setGrid(newGrid);
    const freshStatuses = newGrid.map(() => cardStatuses.hole);
    statusesRef.current = freshStatuses;
    firstClickedRef.current = null;
    setStatuses(freshStatuses);
    setFirstClicked(null);
    setMoves(0);
    setSavedElapsed(null);
    setPhase("playing");
  };

  // Win detection (adapted from upstream useEffect match-checker)
  useEffect(() => {
    if (!ready) return;
    if (statuses.length === 0) return;
    if (statuses.every((s) => s === cardStatuses.discovered)) {
      setPhase("won");
      const finalElapsed = elapsed;
      setMoves((m) => {
        // Use functional updater to read latest moves; save inside updater
        if (!replayKey) {
          saveProgress(dateKey, { completed: true, moves: m, elapsed: finalElapsed });
          completeGame(MEMORY_GAME_SLUG, "win", dateKey);
          trackEvent(createGameCompleteEvent(MEMORY_GAME_SLUG, dateKey, "win"));
          void submitLeaderboardScore(MEMORY_GAME_SLUG, dateKey, m);
        }
        return m;
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statuses, ready, replayKey]);

  const handleCardClick = (idx: number) => {
    if (phase !== "playing") return;
    if (statusesRef.current[idx] !== cardStatuses.hole) return;

    const currentFirst = firstClickedRef.current;

    if (currentFirst === null) {
      // First card of the pair
      setStatuses((prev) => {
        const next = [...prev];
        next[idx] = cardStatuses.clicked;
        return next;
      });
      setFirstClicked(idx);
      firstClickedRef.current = idx;
    } else {
      // Second card of the pair — increment moves
      setStatuses((prev) => {
        const next = [...prev];
        next[idx] = cardStatuses.clicked;
        return next;
      });
      setMoves((m) => m + 1);
      setFirstClicked(null);
      firstClickedRef.current = null;

      if (grid[currentFirst] === grid[idx]) {
        // Match — lock in after 200ms
        matchTimerRef.current = setTimeout(() => {
          setStatuses((prev) => {
            const next = [...prev];
            next[currentFirst] = cardStatuses.discovered;
            next[idx] = cardStatuses.discovered;
            return next;
          });
        }, 200);
      } else {
        // No match — flip back after 700ms
        matchTimerRef.current = setTimeout(() => {
          setStatuses((prev) => {
            const next = [...prev];
            if (next[currentFirst] === cardStatuses.clicked) next[currentFirst] = cardStatuses.hole;
            if (next[idx] === cardStatuses.clicked) next[idx] = cardStatuses.hole;
            return next;
          });
        }, 700);
      }
    }
  };

  if (!ready) {
    return (
      <section className="mem-game" aria-label="Daily Memory Game">
        <p className="mem-loading">Loading…</p>
      </section>
    );
  }

  const displayElapsed = savedElapsed !== null ? savedElapsed : elapsed;

  // Cards render as a flat array but role="grid" requires role="row" children
  // (with role="gridcell" descendants) rather than direct gridcell/interactive
  // children — chunk the flat grid into 4-wide rows for both instances below.
  // Row/cell wrapper divs use the .a11y-grid-row (display: contents) utility
  // so they carry ARIA semantics without participating in the CSS grid box
  // tree — the actual .mem-card elements remain the grid's visual cells.
  const MEM_GRID_COLS = 4;
  const gridRows = Array.from(
    { length: Math.ceil(grid.length / MEM_GRID_COLS) },
    (_, r) => grid.slice(r * MEM_GRID_COLS, r * MEM_GRID_COLS + MEM_GRID_COLS)
  );

  if (phase === "won") {
    return (
      <section className="mem-game mem-result" aria-label="Daily Memory Game Results">
        <header className="mem-header">
          <h2>Daily Memory Table</h2>
          <time dateTime={dateKey || initialDateKey}>{dateKey || initialDateKey} (UTC)</time>
        </header>

        <p className="mem-win-message">
          All matched! Moves: {moves} · Time: {formatTime(displayElapsed)}
        </p>

        <div
          className="mem-grid"
          role="grid"
          aria-label="Memory card grid — all matched"
          style={{ "--mem-cols": 4 } as React.CSSProperties}
        >
          {gridRows.map((rowSymbols, r) => (
            <div key={r} role="row" className="a11y-grid-row">
              {rowSymbols.map((symbol, c) => {
                const i = r * MEM_GRID_COLS + c;
                return (
                  <div key={i} role="gridcell" className="a11y-grid-row">
                    <Card
                      index={i}
                      symbol={symbol}
                      isFlipped={false}
                      isMatched={true}
                      onClick={() => undefined}
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="mem-replay-row">
          <button className="mem-replay-btn" onClick={resetGame}>
            Play Again
          </button>
          <p className="mem-comeback">Come back tomorrow for a new layout!</p>
        </div>
      </section>
    );
  }

  return (
    <section className="mem-game" aria-label="Daily Memory Game" data-ready={ready}>
      <header className="mem-header">
        <h2>Daily Memory Table</h2>
        <time dateTime={dateKey}>{dateKey} (UTC)</time>
      </header>

      <div className="mem-stats" aria-label="Game stats">
        <span>Moves: {moves}</span>
        <span aria-label={`Time: ${formatTime(elapsed)}`}>{formatTime(elapsed)}</span>
      </div>

      <div
        className="mem-grid"
        role="grid"
        aria-label="Memory card grid"
        style={{ "--mem-cols": 4 } as React.CSSProperties}
      >
        {gridRows.map((rowSymbols, r) => (
          <div key={r} role="row" className="a11y-grid-row">
            {rowSymbols.map((symbol, c) => {
              const i = r * MEM_GRID_COLS + c;
              return (
                <div key={i} role="gridcell" className="a11y-grid-row">
                  <Card
                    index={i}
                    symbol={symbol}
                    isFlipped={statuses[i] === cardStatuses.clicked}
                    isMatched={statuses[i] === cardStatuses.discovered}
                    onClick={() => handleCardClick(i)}
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}
