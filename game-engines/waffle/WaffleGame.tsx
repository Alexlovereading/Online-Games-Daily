"use client";

import { useEffect, useRef, useState } from "react";
import { createGameCompleteEvent, trackEvent } from "../../lib/analytics";
import { getDailySeed, getUtcDateKey, makeReplayKey, makeSeededRng } from "../../lib/daily";
import { submitLeaderboardScore } from "../../lib/leaderboard-client";
import { completeGame } from "../../lib/stats";
import { lsGet, lsSet } from "../../lib/storage";
import puzzlesData from "../../data/waffle/puzzles.json";
import {
  MAX_SWAPS,
  buildSolutionGrid,
  checkSolved,
  getCellStatus,
  isDarkCell,
  scrambleGrid,
  swapCells,
  type CellStatus,
  type Position,
  type WaffleGrid,
  type WafflePuzzle,
} from "./waffle-core";

export const WAFFLE_SLUG = "waffle";

const PUZZLES = puzzlesData as WafflePuzzle[];

type GameStatus = "playing" | "won" | "lost";

type SavedProgress = {
  grid: WaffleGrid;
  swapsRemaining: number;
  status: GameStatus;
};

/** Deterministically picks today's puzzle from the date-seeded RNG. */
export function pickPuzzleIndex(dateKey: string, puzzleCount: number): number {
  if (puzzleCount <= 0) return 0;
  const rng = makeSeededRng(getDailySeed(dateKey, WAFFLE_SLUG));
  return Math.floor(rng() * puzzleCount);
}

function getProgressKey(dateKey: string): string {
  return `dgh:${WAFFLE_SLUG}:${dateKey}`;
}

function activeLetterMultiset(grid: WaffleGrid): string[] {
  const letters: string[] = [];
  for (let row = 0; row < 5; row += 1) {
    for (let col = 0; col < 5; col += 1) {
      if (!isDarkCell(row, col)) letters.push(grid[row][col] ?? "");
    }
  }
  return letters.sort();
}

function isValidGridShape(grid: unknown): grid is WaffleGrid {
  if (!Array.isArray(grid) || grid.length !== 5) return false;
  return grid.every(
    (row) =>
      Array.isArray(row) &&
      row.length === 5 &&
      row.every((cell) => cell === null || (typeof cell === "string" && /^[A-Z]$/.test(cell))),
  );
}

/** Confirms a saved grid is a genuine permutation of today's solution (same letters, same dark cells). */
function isConsistentWithSolution(grid: WaffleGrid, solutionGrid: WaffleGrid): boolean {
  for (let row = 0; row < 5; row += 1) {
    for (let col = 0; col < 5; col += 1) {
      const isDark = isDarkCell(row, col);
      if (isDark && grid[row][col] !== null) return false;
      if (!isDark && grid[row][col] === null) return false;
    }
  }
  const a = activeLetterMultiset(grid);
  const b = activeLetterMultiset(solutionGrid);
  return a.length === b.length && a.every((letter, i) => letter === b[i]);
}

function loadProgress(dateKey: string, solutionGrid: WaffleGrid): SavedProgress | null {
  if (typeof window === "undefined") return null;
  const raw = lsGet(getProgressKey(dateKey));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SavedProgress>;
    if (
      !isValidGridShape(parsed.grid) ||
      typeof parsed.swapsRemaining !== "number" ||
      parsed.swapsRemaining < 0 ||
      parsed.swapsRemaining > MAX_SWAPS ||
      (parsed.status !== "playing" && parsed.status !== "won" && parsed.status !== "lost")
    ) {
      return null;
    }
    if (!isConsistentWithSolution(parsed.grid, solutionGrid)) return null;
    return { grid: parsed.grid, swapsRemaining: parsed.swapsRemaining, status: parsed.status };
  } catch {
    return null;
  }
}

function saveProgress(dateKey: string, progress: SavedProgress): void {
  if (typeof window === "undefined") return;
  lsSet(getProgressKey(dateKey), JSON.stringify(progress));
}

function statusClass(status: CellStatus): string {
  if (status === "correct") return "letter-correct";
  if (status === "present") return "letter-elsewhere";
  return "letter-absent";
}

export function WaffleGame({ initialDateKey }: { initialDateKey: string }) {
  const [dateKey, setDateKey] = useState("");
  const [puzzle, setPuzzle] = useState<WafflePuzzle | null>(null);
  const [solutionGrid, setSolutionGrid] = useState<WaffleGrid | null>(null);
  const [grid, setGrid] = useState<WaffleGrid | null>(null);
  const [swapsRemaining, setSwapsRemaining] = useState(MAX_SWAPS);
  const [selected, setSelected] = useState<Position | null>(null);
  const [status, setStatus] = useState<GameStatus>("playing");
  const [ready, setReady] = useState(false);
  const [replayKey, setReplayKey] = useState<string | null>(null);

  const started = useRef(false);

  useEffect(() => {
    const today = getUtcDateKey();
    const index = pickPuzzleIndex(today, PUZZLES.length);
    const todaysPuzzle = PUZZLES[index] ?? PUZZLES[0] ?? null;

    setDateKey(today);
    setPuzzle(todaysPuzzle);

    if (todaysPuzzle) {
      const solution = buildSolutionGrid(todaysPuzzle);
      setSolutionGrid(solution);

      const saved = loadProgress(today, solution);
      if (saved) {
        setGrid(saved.grid);
        setSwapsRemaining(saved.swapsRemaining);
        setStatus(saved.status);
        if (saved.swapsRemaining < MAX_SWAPS || saved.status !== "playing") started.current = true;
      } else {
        const scrambled = scrambleGrid(solution, today, WAFFLE_SLUG);
        setGrid(scrambled.grid);
        setSwapsRemaining(scrambled.swapsRemaining);
        setStatus("playing");
        saveProgress(today, {
          grid: scrambled.grid,
          swapsRemaining: scrambled.swapsRemaining,
          status: "playing",
        });
      }
    }

    setReady(true);
  }, []);

  const markStarted = () => {
    if (started.current || !dateKey) return;
    started.current = true;
    trackEvent({ name: "game_start", slug: WAFFLE_SLUG, dateKey });
  };

  // "Play Again": a fresh, randomly-picked puzzle held in memory only — today's
  // real result in localStorage is never touched, so a refresh mid-replay
  // lands back on today's actual outcome.
  const handlePlayAgain = () => {
    const newKey = makeReplayKey();
    const index = pickPuzzleIndex(newKey, PUZZLES.length);
    const nextPuzzle = PUZZLES[index] ?? PUZZLES[0] ?? null;
    if (!nextPuzzle) return;

    const solution = buildSolutionGrid(nextPuzzle);
    const scrambled = scrambleGrid(solution, newKey, WAFFLE_SLUG);

    setReplayKey(newKey);
    setPuzzle(nextPuzzle);
    setSolutionGrid(solution);
    setGrid(scrambled.grid);
    setSwapsRemaining(scrambled.swapsRemaining);
    setSelected(null);
    setStatus("playing");
    started.current = false;
  };

  const handleCellClick = (pos: Position) => {
    if (!ready || status !== "playing" || !grid || !solutionGrid || !dateKey) return;

    markStarted();

    if (!selected) {
      setSelected(pos);
      return;
    }

    if (selected.row === pos.row && selected.col === pos.col) {
      setSelected(null);
      return;
    }

    const nextGrid = swapCells(grid, selected, pos);
    const nextSwapsRemaining = swapsRemaining - 1;
    const solved = checkSolved(nextGrid, solutionGrid);
    const nextStatus: GameStatus = solved ? "won" : nextSwapsRemaining <= 0 ? "lost" : "playing";

    setGrid(nextGrid);
    setSwapsRemaining(nextSwapsRemaining);
    setSelected(null);
    setStatus(nextStatus);

    if (!replayKey) {
      saveProgress(dateKey, { grid: nextGrid, swapsRemaining: nextSwapsRemaining, status: nextStatus });

      if (nextStatus !== "playing") {
        const result = nextStatus === "won" ? "win" : "lose";
        completeGame(WAFFLE_SLUG, result, dateKey);
        trackEvent(createGameCompleteEvent(WAFFLE_SLUG, dateKey, result));
        if (result === "win") {
          void submitLeaderboardScore(WAFFLE_SLUG, dateKey, MAX_SWAPS - nextSwapsRemaining);
        }
      }
    }
  };

  if (!ready || !puzzle || !grid || !solutionGrid) {
    return (
      <section aria-label="Daily Waffle" className="flex items-center justify-center py-10">
        <p className="text-sm text-subtle-foreground">Loading…</p>
      </section>
    );
  }

  const finished = status !== "playing";
  const isWin = status === "won";

  return (
    <section aria-label="Daily Waffle" className="flex flex-col items-center gap-4 py-2">
      <header className="flex w-full flex-col items-center gap-1">
        <h2 className="font-display text-xl font-bold text-foreground">Daily Waffle</h2>
        <time dateTime={dateKey || initialDateKey} className="text-xs text-subtle-foreground">
          {dateKey || initialDateKey} (UTC)
        </time>
      </header>

      <div
        className="flex items-baseline gap-2 rounded-md bg-subtle px-3 py-1.5"
        aria-label={`Swaps remaining: ${swapsRemaining}`}
      >
        <span className="font-display text-2xl font-bold text-foreground">{swapsRemaining}</span>
        <span className="text-xs text-subtle-foreground">swaps remaining</span>
      </div>

      <div
        className="mx-auto grid w-full max-w-xs grid-cols-5 gap-1.5 sm:max-w-sm sm:gap-2"
        role="group"
        aria-label="Waffle letter grid"
      >
        {grid.map((rowLetters, row) =>
          rowLetters.map((letter, col) => {
            if (isDarkCell(row, col)) {
              return (
                <div
                  key={`${row}-${col}`}
                  className="invisible aspect-square rounded-md"
                  aria-hidden="true"
                />
              );
            }

            const pos: Position = { row, col };
            const cellStatus = getCellStatus(grid, solutionGrid, pos);
            const isSelected = selected?.row === row && selected?.col === col;

            return (
              <button
                key={`${row}-${col}`}
                type="button"
                onClick={() => handleCellClick(pos)}
                disabled={finished}
                aria-label={`Row ${row + 1}, column ${col + 1}: ${letter}, ${cellStatus}`}
                aria-pressed={isSelected}
                className={`aspect-square rounded-md text-lg font-display font-bold uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-default sm:text-xl ${statusClass(
                  cellStatus,
                )} ${isSelected ? "ring-2 ring-primary" : ""}`}
              >
                {letter}
              </button>
            );
          }),
        )}
      </div>

      {!finished && (
        <p className="text-xs text-subtle-foreground" role="status" aria-live="polite">
          {selected
            ? "Pick a second letter to swap with."
            : "Tap a letter, then tap another to swap them into place."}
        </p>
      )}

      {finished && (
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-base font-bold text-foreground">
            {isWin ? "Solved it — nice work!" : "Out of swaps!"}
          </p>
          <button
            type="button"
            onClick={handlePlayAgain}
            className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-colors hover:opacity-90"
          >
            Play Again
          </button>
          <p className="text-xs text-subtle-foreground">Come back tomorrow for a new daily waffle!</p>
        </div>
      )}
    </section>
  );
}
