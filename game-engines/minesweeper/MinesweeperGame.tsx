"use client";

import { useEffect, useRef, useState } from "react";
import { createGameCompleteEvent, trackEvent } from "../../lib/analytics";
import { getUtcDateKey, makeReplayKey } from "../../lib/daily";
import { submitLeaderboardScore } from "../../lib/leaderboard-client";
import { completeGame, loadStats, type GameStats } from "../../lib/stats";
import { lsGet, lsSet } from "../../lib/storage";
import {
  BOARD_SIZE,
  MINE_COUNT,
  MINESWEEPER_SLUG,
  checkWin,
  generateBoard,
  revealAllMines,
  revealCell,
  toggleFlag,
  type Cell,
} from "./minesweeper-core";

type Phase = "playing" | "won" | "lost";

type SavedProgress = {
  dateKey: string;
  board: Cell[][];
  phase: Phase;
  // null means the board exists (auto-saved on mount, e.g. for the
  // auto-revealed center block) but the player hasn't made their first
  // real move yet — distinct from a genuine elapsed-time anchor, so a
  // resume in that state still starts the leaderboard clock on the
  // player's actual first click rather than back-dating it to whenever
  // the page happened to load.
  startedAt: number | null;
};

const CENTER = Math.floor(BOARD_SIZE / 2);

const NUMBER_COLORS: Record<number, string> = {
  1: "text-blue-400",
  2: "text-green-400",
  3: "text-red-400",
  4: "text-purple-400",
  5: "text-yellow-600",
  6: "text-cyan-400",
  7: "text-foreground",
  8: "text-subtle-foreground",
};

function getProgressKey(dateKey: string): string {
  return `dgh:${MINESWEEPER_SLUG}:${dateKey}`;
}

function loadProgress(dateKey: string): SavedProgress | null {
  if (typeof window === "undefined") return null;
  const raw = lsGet(getProgressKey(dateKey));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SavedProgress;
    if (parsed.dateKey !== dateKey) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveProgress(progress: SavedProgress): void {
  if (typeof window === "undefined") return;
  lsSet(getProgressKey(progress.dateKey), JSON.stringify(progress));
}

function buildInitialBoard(dateKey: string): Cell[][] {
  const fresh = generateBoard(dateKey);
  return revealCell(fresh, CENTER, CENTER);
}

export function MinesweeperGame({ initialDateKey }: { initialDateKey: string }) {
  const [dateKey, setDateKey] = useState("");
  const [board, setBoard] = useState<Cell[][]>([]);
  const [phase, setPhase] = useState<Phase>("playing");
  const [flagMode, setFlagMode] = useState(false);
  const [stats, setStats] = useState<GameStats | null>(null);
  const [ready, setReady] = useState(false);
  const [replayKey, setReplayKey] = useState<string | null>(null);

  const startedRef = useRef(false);
  const phaseRef = useRef<Phase>("playing");
  // Not shown in the UI, but a real wall-clock reading from the first click
  // to a win gives the leaderboard a genuine metric instead of nothing.
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    const today = getUtcDateKey();
    setDateKey(today);
    setStats(loadStats(MINESWEEPER_SLUG));

    const saved = loadProgress(today);
    if (saved) {
      setBoard(saved.board);
      setPhase(saved.phase);
      phaseRef.current = saved.phase;
      if (typeof saved.startedAt === "number" && Number.isFinite(saved.startedAt)) {
        // A real move was already made before this reload — restore the
        // true start time and mark started so the click guard doesn't
        // reset it.
        startedRef.current = true;
        startTimeRef.current = saved.startedAt;
      } else {
        // Either the board was auto-saved on mount but never clicked
        // before reloading (startedAt: null), or this is a save written
        // before the field existed at all (startedAt: undefined) — in
        // both cases we have no verified start time. Leave the clock
        // un-anchored rather than fabricating one: the click guard below
        // will set a fresh, honest startTimeRef the next time the player
        // actually interacts, and that's guaranteed to happen before any
        // eventual win, so the submission is never lost — it just counts
        // from the first click we can actually verify, never a back-dated
        // or fabricated moment that could inflate their leaderboard rank.
        startedRef.current = false;
        startTimeRef.current = null;
      }
      setReady(true);
      return;
    }

    const initialBoard = buildInitialBoard(today);
    setBoard(initialBoard);
    setPhase("playing");
    phaseRef.current = "playing";
    saveProgress({
      dateKey: today,
      board: initialBoard,
      phase: "playing",
      // No click has happened yet — leave the clock un-anchored rather
      // than back-dating it to this mount/page-load moment.
      startedAt: null,
    });
    setReady(true);
  }, []);

  const finishGame = (nextBoard: Cell[][], nextPhase: "won" | "lost") => {
    phaseRef.current = nextPhase;
    setPhase(nextPhase);
    setBoard(nextBoard);

    if (!replayKey) {
      saveProgress({
        dateKey,
        board: nextBoard,
        phase: nextPhase,
        startedAt: startTimeRef.current ?? Date.now(),
      });

      const result = nextPhase === "won" ? "win" : "lose";
      const updated = completeGame(MINESWEEPER_SLUG, result, dateKey);
      setStats(updated);
      trackEvent(createGameCompleteEvent(MINESWEEPER_SLUG, dateKey, result));
      if (nextPhase === "won" && startTimeRef.current !== null) {
        const elapsedSeconds = (Date.now() - startTimeRef.current) / 1000;
        void submitLeaderboardScore(MINESWEEPER_SLUG, dateKey, elapsedSeconds);
      }
    }
  };

  // "Play Again": a fresh, randomly-generated board held in memory only —
  // today's real result in localStorage is never touched.
  const handlePlayAgain = () => {
    const newKey = makeReplayKey();
    const initialBoard = buildInitialBoard(newKey);

    setReplayKey(newKey);
    setBoard(initialBoard);
    setPhase("playing");
    phaseRef.current = "playing";
    setFlagMode(false);
    startedRef.current = false;
  };

  const handleCellClick = (row: number, col: number) => {
    if (!ready || !dateKey || phaseRef.current !== "playing") return;

    if (!startedRef.current) {
      startedRef.current = true;
      startTimeRef.current = Date.now();
      trackEvent({ name: "game_start", slug: MINESWEEPER_SLUG, dateKey });
    }

    if (flagMode) {
      const next = toggleFlag(board, row, col);
      setBoard(next);
      if (!replayKey) {
        saveProgress({
          dateKey,
          board: next,
          phase: "playing",
          startedAt: startTimeRef.current ?? Date.now(),
        });
      }
      return;
    }

    const cell = board[row]?.[col];
    if (!cell || cell.revealed || cell.flagged) return;

    const next = revealCell(board, row, col);

    if (next[row][col].isMine) {
      finishGame(revealAllMines(next), "lost");
      return;
    }

    if (checkWin(next)) {
      finishGame(next, "won");
      return;
    }

    setBoard(next);
    if (!replayKey) {
      saveProgress({
        dateKey,
        board: next,
        phase: "playing",
        startedAt: startTimeRef.current ?? Date.now(),
      });
    }
  };

  const handleFlagClick = (e: React.MouseEvent, row: number, col: number) => {
    e.preventDefault();
    if (!ready || !dateKey || phaseRef.current !== "playing") return;

    if (!startedRef.current) {
      startedRef.current = true;
      startTimeRef.current = Date.now();
      trackEvent({ name: "game_start", slug: MINESWEEPER_SLUG, dateKey });
    }

    const next = toggleFlag(board, row, col);
    setBoard(next);
    if (!replayKey) {
      saveProgress({
        dateKey,
        board: next,
        phase: "playing",
        startedAt: startTimeRef.current ?? Date.now(),
      });
    }
  };

  if (!ready) {
    return (
      <section aria-label="Daily Minesweeper" className="flex items-center justify-center py-10">
        <p className="text-sm text-subtle-foreground">Loading…</p>
      </section>
    );
  }

  const flaggedCount = board.reduce(
    (sum, row) => sum + row.filter((cell) => cell.flagged).length,
    0,
  );
  const minesRemaining = Math.max(0, MINE_COUNT - flaggedCount);

  return (
    <section aria-label="Daily Minesweeper" className="flex flex-col items-center gap-4 py-2" data-ready={ready}>
      <header className="flex w-full flex-col items-center gap-1">
        <h2 className="font-display text-xl font-bold text-foreground">Daily Minesweeper</h2>
        <time dateTime={dateKey || initialDateKey} className="text-xs text-subtle-foreground">
          {dateKey || initialDateKey} (UTC)
        </time>
      </header>

      <dl className="flex items-center gap-4 text-xs text-subtle-foreground" aria-label="Your minesweeper statistics">
        <div className="flex items-center gap-1">
          <dt>Played</dt>
          <dd className="font-bold text-foreground">{stats?.played ?? 0}</dd>
        </div>
        <div className="flex items-center gap-1">
          <dt>Wins</dt>
          <dd className="font-bold text-foreground">{stats?.wins ?? 0}</dd>
        </div>
        <div className="flex items-center gap-1">
          <dt>Streak</dt>
          <dd className="font-bold text-foreground">{stats?.streak ?? 0}</dd>
        </div>
      </dl>

      <div className="flex w-full max-w-sm items-center justify-between gap-3">
        <div
          className="rounded-md bg-subtle px-3 py-1.5 text-sm font-bold text-foreground"
          aria-label={`Mines remaining: ${minesRemaining}`}
        >
          🚩 {minesRemaining}
        </div>
        <button
          type="button"
          onClick={() => setFlagMode((v) => !v)}
          disabled={phase !== "playing"}
          aria-pressed={flagMode}
          className={[
            "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-bold transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            "disabled:cursor-not-allowed disabled:opacity-50",
            flagMode
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-transparent text-foreground hover:bg-subtle",
          ].join(" ")}
        >
          🚩 Flag mode
        </button>
      </div>

      <div
        className="grid w-full max-w-sm gap-0.5"
        style={{ gridTemplateRows: `repeat(${BOARD_SIZE}, 1fr)` }}
        role="grid"
        aria-label={`Minesweeper board, ${BOARD_SIZE} rows by ${BOARD_SIZE} columns`}
      >
        {board.map((row, r) => (
          <div
            key={r}
            className="grid gap-0.5"
            style={{ gridTemplateColumns: `repeat(${BOARD_SIZE}, 1fr)` }}
            role="row"
          >
            {row.map((cell, c) => {
              const label = cell.flagged
                ? `Row ${r + 1}, column ${c + 1}: flagged`
                : cell.revealed
                  ? cell.isMine
                    ? `Row ${r + 1}, column ${c + 1}: mine`
                    : `Row ${r + 1}, column ${c + 1}: ${cell.adjacentMines === 0 ? "empty" : cell.adjacentMines}`
                  : `Row ${r + 1}, column ${c + 1}: hidden`;

              let classes =
                "aspect-square select-none rounded-sm text-xs sm:text-sm font-bold flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

              if (cell.revealed) {
                classes += cell.isMine && phase === "lost" ? " bg-red-900" : " bg-card text-card-foreground";
                if (!cell.isMine && cell.adjacentMines > 0) {
                  classes += ` ${NUMBER_COLORS[cell.adjacentMines] ?? "text-foreground"}`;
                }
              } else {
                classes += " bg-subtle hover:bg-border";
              }

              return (
                <button
                  key={`${r}-${c}`}
                  type="button"
                  role="gridcell"
                  className={classes}
                  onClick={() => handleCellClick(r, c)}
                  onContextMenu={(e) => handleFlagClick(e, r, c)}
                  disabled={phase !== "playing"}
                  aria-label={label}
                >
                  {cell.flagged
                    ? "🚩"
                    : cell.revealed
                      ? cell.isMine
                        ? "💣"
                        : cell.adjacentMines > 0
                          ? cell.adjacentMines
                          : ""
                      : ""}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {phase !== "playing" && (
        <div className="flex w-full max-w-sm flex-col items-center gap-2 text-center" role="status" aria-live="polite">
          <p className="text-base font-bold text-foreground">
            {phase === "won" ? "You cleared the board! 🎉" : "Boom — you hit a mine."}
          </p>
          <button
            type="button"
            onClick={handlePlayAgain}
            className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-colors hover:opacity-90"
          >
            Play Again
          </button>
          <p className="text-xs text-subtle-foreground">Come back tomorrow for a new daily board!</p>
        </div>
      )}

      {phase === "playing" && (
        <p className="text-xs text-subtle-foreground">
          {flagMode
            ? "Flag mode on — tap a cell to place or remove a flag."
            : "Tap a cell to reveal it, or right-click to flag a suspected mine."}
        </p>
      )}
    </section>
  );
}
