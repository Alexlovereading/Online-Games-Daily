"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createGameCompleteEvent, trackEvent } from "../../lib/analytics";
import { getUtcDateKey, makeReplayKey } from "../../lib/daily";
import { submitLeaderboardScore } from "../../lib/leaderboard-client";
import { completeGame } from "../../lib/stats";
import { lsGet, lsSet } from "../../lib/storage";
import { cn } from "../../lib/utils";
import {
  GRID_SIZE,
  WORD_SEARCH_SLUG,
  generateDailyPuzzle,
  type WordSearchPuzzle,
} from "./word-search-core";

type SavedProgress = {
  foundWords: string[];
  completed: boolean;
  // Optional: absent on saves written before this field existed.
  startedAt?: number;
};

type Cell = { row: number; col: number };

function getProgressKey(dateKey: string): string {
  return `dgh:${WORD_SEARCH_SLUG}:${dateKey}`;
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

function cellKey(row: number, col: number): string {
  return `${row},${col}`;
}

/** Returns the straight-line path of cells between two points (inclusive), or null if they don't form a horizontal, vertical, or diagonal line. */
function lineBetween(a: Cell, b: Cell): Cell[] | null {
  const dRow = b.row - a.row;
  const dCol = b.col - a.col;
  if (dRow === 0 && dCol === 0) return [a];

  const isHorizontal = dRow === 0;
  const isVertical = dCol === 0;
  const isDiagonal = Math.abs(dRow) === Math.abs(dCol);
  if (!isHorizontal && !isVertical && !isDiagonal) return null;

  const stepRow = Math.sign(dRow);
  const stepCol = Math.sign(dCol);
  const length = Math.max(Math.abs(dRow), Math.abs(dCol)) + 1;

  const cells: Cell[] = [];
  for (let i = 0; i < length; i += 1) {
    cells.push({ row: a.row + stepRow * i, col: a.col + stepCol * i });
  }
  return cells;
}

export function WordSearchGame({ initialDateKey }: { initialDateKey: string }) {
  const [dateKey, setDateKey] = useState("");
  const [puzzle, setPuzzle] = useState<WordSearchPuzzle | null>(null);
  const [foundWords, setFoundWords] = useState<Set<string>>(new Set());
  const [selectionStart, setSelectionStart] = useState<Cell | null>(null);
  const [flashCells, setFlashCells] = useState<Set<string> | null>(null);
  const [ready, setReady] = useState(false);
  const [replayKey, setReplayKey] = useState<string | null>(null);

  const startedRef = useRef(false);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Not shown in the UI (this game is untimed by design), but a real wall-
  // clock reading from first click to completion gives the leaderboard a
  // genuine metric instead of nothing.
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    const today = getUtcDateKey();
    const dailyPuzzle = generateDailyPuzzle(today);
    const saved = loadProgress(today);

    setDateKey(today);
    setPuzzle(dailyPuzzle);
    if (saved) {
      setFoundWords(new Set(saved.foundWords));
      if (saved.foundWords.length > 0 || saved.completed) {
        if (typeof saved.startedAt === "number") {
          startedRef.current = true;
          startTimeRef.current = saved.startedAt;
        } else {
          // Older saved-progress object, written before `startedAt`
          // existed. We have no verified start time — leave the clock
          // un-anchored rather than fabricating one with Date.now() (which
          // would only count time from this reload onward and could
          // inflate this player's leaderboard rank if real progress
          // already happened before it). The click guard below sets a
          // fresh, honest startTimeRef the next time the player actually
          // selects a cell, which is guaranteed to happen before any
          // eventual win, so the submission is never lost either way.
          startedRef.current = false;
          startTimeRef.current = null;
        }
      }
    }
    setReady(true);

    return () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, []);

  const completed = puzzle ? foundWords.size >= puzzle.words.length : false;

  const foundCellKeys = useMemo(() => {
    const keys = new Set<string>();
    if (!puzzle) return keys;
    for (const w of puzzle.words) {
      if (!foundWords.has(w.word)) continue;
      for (const [row, col] of w.cells) keys.add(cellKey(row, col));
    }
    return keys;
  }, [puzzle, foundWords]);

  const flashInvalid = (cells: Cell[]) => {
    setFlashCells(new Set(cells.map((c) => cellKey(c.row, c.col))));
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setFlashCells(null), 400);
  };

  const handleCellClick = (row: number, col: number) => {
    if (!ready || !puzzle || completed) return;

    if (!startedRef.current) {
      startedRef.current = true;
      startTimeRef.current = Date.now();
      trackEvent({ name: "game_start", slug: WORD_SEARCH_SLUG, dateKey });
    }

    if (!selectionStart) {
      setSelectionStart({ row, col });
      return;
    }

    if (selectionStart.row === row && selectionStart.col === col) {
      setSelectionStart(null);
      return;
    }

    const end = { row, col };
    const path = lineBetween(selectionStart, end);
    setSelectionStart(null);

    if (!path) {
      flashInvalid([selectionStart, end]);
      return;
    }

    const forward = path.map((c) => puzzle.grid[c.row][c.col]).join("");
    const backward = [...forward].reverse().join("");

    const match = puzzle.words.find(
      (w) => !foundWords.has(w.word) && (w.word === forward || w.word === backward),
    );

    if (!match) {
      flashInvalid(path);
      return;
    }

    const nextFound = new Set(foundWords);
    nextFound.add(match.word);
    setFoundWords(nextFound);

    const allFound = nextFound.size >= puzzle.words.length;

    if (!replayKey) {
      saveProgress(dateKey, {
        foundWords: [...nextFound],
        completed: allFound,
        startedAt: startTimeRef.current ?? Date.now(),
      });

      if (allFound) {
        completeGame(WORD_SEARCH_SLUG, "win", dateKey);
        trackEvent(createGameCompleteEvent(WORD_SEARCH_SLUG, dateKey, "win"));
        if (startTimeRef.current !== null) {
          const elapsedSeconds = (Date.now() - startTimeRef.current) / 1000;
          void submitLeaderboardScore(WORD_SEARCH_SLUG, dateKey, elapsedSeconds);
        }
      }
    }
  };

  // "Play Again": a fresh, randomly-picked theme/word-list held in memory
  // only — today's real result in localStorage is never touched.
  const handlePlayAgain = () => {
    const newKey = makeReplayKey();
    const nextPuzzle = generateDailyPuzzle(newKey);

    setReplayKey(newKey);
    setPuzzle(nextPuzzle);
    setFoundWords(new Set());
    setSelectionStart(null);
    setFlashCells(null);
    startedRef.current = false;
  };

  if (!ready || !puzzle) {
    return (
      <section aria-label="Daily Word Search" className="flex items-center justify-center py-10">
        <p className="text-sm text-subtle-foreground">Loading…</p>
      </section>
    );
  }

  return (
    <section aria-label="Daily Word Search" className="flex flex-col items-center gap-4 py-2" data-ready={ready}>
      <header className="flex w-full flex-col items-center gap-1">
        <h2 className="font-display text-xl font-bold text-foreground">Daily Word Search</h2>
        <time dateTime={dateKey || initialDateKey} className="text-xs text-subtle-foreground">
          {dateKey || initialDateKey} (UTC)
        </time>
        <p className="text-sm font-bold text-primary">Theme: {puzzle.theme}</p>
      </header>

      {completed && (
        <div className="flex w-full max-w-sm flex-col items-center gap-2 rounded-lg border border-border bg-subtle p-3 text-center">
          <p className="text-base font-bold text-foreground">All {puzzle.words.length} words found!</p>
          <button
            type="button"
            onClick={handlePlayAgain}
            className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-colors hover:opacity-90"
          >
            Play Again
          </button>
          <p className="text-xs text-subtle-foreground">Come back tomorrow for a new daily theme!</p>
        </div>
      )}

      <div
        className="grid w-full max-w-md gap-0.5"
        style={{ gridTemplateRows: `repeat(${GRID_SIZE}, minmax(0, 1fr))` }}
        role="grid"
        aria-label={`Word search grid, ${GRID_SIZE} by ${GRID_SIZE}`}
      >
        {puzzle.grid.map((rowLetters, r) => (
          <div
            key={r}
            className="grid gap-0.5"
            style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))` }}
            role="row"
          >
            {rowLetters.map((letter, c) => {
              const key = cellKey(r, c);
              const isFound = foundCellKeys.has(key);
              const isSelected = selectionStart?.row === r && selectionStart?.col === c;
              const isFlash = flashCells?.has(key) ?? false;

              return (
                <button
                  key={key}
                  type="button"
                  role="gridcell"
                  onClick={() => handleCellClick(r, c)}
                  disabled={completed}
                  aria-label={`Row ${r + 1}, column ${c + 1}: ${letter}`}
                  aria-pressed={isSelected}
                  className={cn(
                    "aspect-square select-none rounded-sm font-mono text-xs sm:text-sm font-bold flex items-center justify-center transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    "disabled:cursor-default",
                    isFound
                      ? "bg-primary text-primary-foreground"
                      : isFlash
                        ? "bg-red-900/70 text-foreground"
                        : isSelected
                          ? "bg-subtle text-foreground ring-2 ring-primary"
                          : "bg-card text-card-foreground hover:bg-subtle",
                  )}
                >
                  {letter}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div
        className="flex w-full max-w-md flex-wrap justify-center gap-x-4 gap-y-1.5"
        aria-label="Words to find"
      >
        {puzzle.words.map((w) => (
          <span
            key={w.word}
            className={cn(
              "font-mono text-sm font-bold tracking-wide",
              foundWords.has(w.word) ? "text-subtle-foreground line-through" : "text-foreground",
            )}
          >
            {w.word}
          </span>
        ))}
      </div>

      <p className="text-xs text-subtle-foreground" aria-live="polite">
        {completed
          ? "Puzzle complete!"
          : `Tap a letter to start, then tap another to select a straight line. ${foundWords.size}/${puzzle.words.length} found.`}
      </p>
    </section>
  );
}
