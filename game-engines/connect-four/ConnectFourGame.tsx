"use client";

/**
 * Daily Connect Four — player vs. a seeded AI opponent.
 *
 * There's no realtime PVP backend on this site, so "daily challenge" means
 * everyone faces the same AI behavior pattern on a given UTC day (see
 * connect-four-core.ts for how the AI's random fallback is seeded). The
 * player always drops first.
 */

import { useEffect, useRef, useState } from "react";
import { createGameCompleteEvent, trackEvent } from "../../lib/analytics";
import { getUtcDateKey, makeReplayKey } from "../../lib/daily";
import { submitLeaderboardScore } from "../../lib/leaderboard-client";
import { completeGame, loadStats, type GameStats } from "../../lib/stats";
import { lsGet, lsSet } from "../../lib/storage";
import { cn } from "../../lib/utils";
import {
  checkWinner,
  CONNECT_FOUR_SLUG,
  COLS,
  countPieces,
  createEmptyBoard,
  dropPiece,
  getAiMove,
  getWinningLine,
  isBoardFull,
  isColumnPlayable,
  ROWS,
  type Board,
} from "./connect-four-core";

type Phase = "playing" | "won" | "lost" | "draw";

type SavedProgress = {
  dateKey: string;
  board: Board;
  phase: Phase;
};

const AI_THINK_MS = 500;

function getProgressKey(dateKey: string): string {
  return `dgh:${CONNECT_FOUR_SLUG}:${dateKey}`;
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

export function ConnectFourGame({ initialDateKey }: { initialDateKey: string }) {
  const [dateKey, setDateKey] = useState("");
  const [board, setBoard] = useState<Board>(createEmptyBoard);
  const [phase, setPhase] = useState<Phase>("playing");
  const [aiThinking, setAiThinking] = useState(false);
  const [stats, setStats] = useState<GameStats | null>(null);
  const [ready, setReady] = useState(false);
  const [replayKey, setReplayKey] = useState<string | null>(null);

  const startedRef = useRef(false);
  const phaseRef = useRef<Phase>("playing");
  const aiTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const today = getUtcDateKey();
    setDateKey(today);
    setStats(loadStats(CONNECT_FOUR_SLUG));

    const saved = loadProgress(today);
    if (saved) {
      setBoard(saved.board);
      setPhase(saved.phase);
      phaseRef.current = saved.phase;
      startedRef.current = true;
      setReady(true);

      // Edge case: the player moved, but the page closed/refreshed before the
      // AI's delayed response landed (odd piece count while still "playing").
      // Finish that pending AI turn now instead of leaving it as if it were
      // the player's move again.
      if (saved.phase === "playing" && countPieces(saved.board) % 2 === 1) {
        setAiThinking(true);
        aiTimeoutRef.current = setTimeout(() => {
          const moveNumber = countPieces(saved.board);
          const aiCol = getAiMove(saved.board, today, moveNumber);
          const afterAi = dropPiece(saved.board, aiCol, "ai");

          setAiThinking(false);

          if (checkWinner(afterAi) === "ai") {
            finishGame(afterAi, "lost", today);
            return;
          }
          if (isBoardFull(afterAi)) {
            finishGame(afterAi, "draw", today);
            return;
          }

          setBoard(afterAi);
          saveProgress({ dateKey: today, board: afterAi, phase: "playing" });
        }, AI_THINK_MS);
      }
      return;
    }

    const initialBoard = createEmptyBoard();
    setBoard(initialBoard);
    setPhase("playing");
    phaseRef.current = "playing";
    saveProgress({ dateKey: today, board: initialBoard, phase: "playing" });
    setReady(true);
  }, []);

  useEffect(() => {
    return () => {
      if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current);
    };
  }, []);

  const finishGame = (nextBoard: Board, nextPhase: "won" | "lost" | "draw", currentDateKey: string) => {
    phaseRef.current = nextPhase;
    setPhase(nextPhase);
    setBoard(nextBoard);

    if (!replayKey) {
      saveProgress({ dateKey: currentDateKey, board: nextBoard, phase: nextPhase });

      const result = nextPhase === "won" ? "win" : "lose";
      const updated = completeGame(CONNECT_FOUR_SLUG, result, currentDateKey);
      setStats(updated);
      trackEvent(createGameCompleteEvent(CONNECT_FOUR_SLUG, currentDateKey, result));
      if (nextPhase === "won") {
        void submitLeaderboardScore(CONNECT_FOUR_SLUG, currentDateKey, nextBoard.flat().filter((c) => c !== null).length);
      }
    }
  };

  // "Play Again": a fresh empty board with an AI seeded off a synthetic
  // per-round key, held in memory only — today's real result in localStorage
  // is never touched.
  const handlePlayAgain = () => {
    if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current);
    setReplayKey(makeReplayKey());
    setBoard(createEmptyBoard());
    setPhase("playing");
    phaseRef.current = "playing";
    setAiThinking(false);
    startedRef.current = false;
  };

  const handleColumnClick = (col: number) => {
    if (!ready || !dateKey || phaseRef.current !== "playing" || aiThinking) return;
    if (!isColumnPlayable(board, col)) return;

    if (!startedRef.current) {
      startedRef.current = true;
      trackEvent({ name: "game_start", slug: CONNECT_FOUR_SLUG, dateKey });
    }

    // The AI's seed follows the active round — today's real dateKey for the
    // daily game, or this round's synthetic key during a replay — so replay
    // rounds get different (but internally consistent) AI behavior.
    const activeKey = replayKey ?? dateKey;

    const afterPlayer = dropPiece(board, col, "player");

    if (checkWinner(afterPlayer) === "player") {
      finishGame(afterPlayer, "won", dateKey);
      return;
    }

    if (isBoardFull(afterPlayer)) {
      finishGame(afterPlayer, "draw", dateKey);
      return;
    }

    setBoard(afterPlayer);
    if (!replayKey) saveProgress({ dateKey, board: afterPlayer, phase: "playing" });
    setAiThinking(true);

    aiTimeoutRef.current = setTimeout(() => {
      const moveNumber = countPieces(afterPlayer);
      const aiCol = getAiMove(afterPlayer, activeKey, moveNumber);
      const afterAi = dropPiece(afterPlayer, aiCol, "ai");

      setAiThinking(false);

      if (checkWinner(afterAi) === "ai") {
        finishGame(afterAi, "lost", dateKey);
        return;
      }

      if (isBoardFull(afterAi)) {
        finishGame(afterAi, "draw", dateKey);
        return;
      }

      setBoard(afterAi);
      if (!replayKey) saveProgress({ dateKey, board: afterAi, phase: "playing" });
    }, AI_THINK_MS);
  };

  if (!ready) {
    return (
      <section aria-label="Daily Connect Four" className="flex items-center justify-center py-10">
        <p className="text-sm text-subtle-foreground">Loading…</p>
      </section>
    );
  }

  const winningLine = phase !== "playing" ? getWinningLine(board) : null;
  const winningKeys = new Set((winningLine ?? []).map(([r, c]) => `${r},${c}`));
  const validColumns = new Set(
    Array.from({ length: COLS }, (_, c) => c).filter((c) => isColumnPlayable(board, c)),
  );

  const statusMessage =
    phase === "won"
      ? "You connected four! 🎉"
      : phase === "lost"
        ? "The AI connected four first."
        : phase === "draw"
          ? "Board's full — it's a draw."
          : aiThinking
            ? "AI is thinking…"
            : "Your move — pick a column.";

  return (
    <section aria-label="Daily Connect Four" className="flex flex-col items-center gap-4 py-2" data-ready={ready}>
      <header className="flex w-full flex-col items-center gap-1">
        <h2 className="font-display text-xl font-bold text-foreground">Daily Connect Four</h2>
        <time dateTime={dateKey || initialDateKey} className="text-xs text-subtle-foreground">
          {dateKey || initialDateKey} (UTC)
        </time>
      </header>

      <dl className="flex items-center gap-4 text-xs text-subtle-foreground" aria-label="Your Connect Four statistics">
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

      <div className="flex w-full max-w-sm items-center justify-center gap-4 text-xs text-subtle-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full bg-red-500" aria-hidden="true" />
          You
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full bg-yellow-400" aria-hidden="true" />
          AI
        </span>
      </div>

      <div
        className="grid w-full max-w-sm gap-1 rounded-lg bg-blue-900/40 p-2"
        style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}
        role="group"
        aria-label={`Connect Four board, ${COLS} columns by ${ROWS} rows`}
      >
        {Array.from({ length: COLS }, (_, col) => {
          const disabled = phase !== "playing" || aiThinking || !validColumns.has(col);

          // Each column is one clickable control (dropping a piece always
          // lands in that column's lowest empty cell) — the individual
          // pieces stacked inside it are a visual readout, not independent
          // interactive gridcells, so ARIA grid/row/gridcell roles don't
          // fit here (a gridcell's parent must be a row, and this button
          // already IS the actionable unit spanning the whole column).
          // Screen-reader users get the column's full state — top to
          // bottom — folded into this one button's label instead.
          const columnPieces = Array.from({ length: ROWS }, (_, row) => board[row][col]);
          const filledCount = columnPieces.filter((cell) => cell !== null).length;
          const columnSummary =
            filledCount === 0
              ? "empty"
              : columnPieces
                  .map((cell) => (cell === "player" ? "your piece" : cell === "ai" ? "AI piece" : "empty"))
                  .join(", ");
          const actionHint = disabled ? "" : " — tap to drop a piece here";

          return (
            <button
              key={`col-${col}`}
              type="button"
              onClick={() => handleColumnClick(col)}
              disabled={disabled}
              aria-label={`Column ${col + 1}, top to bottom: ${columnSummary}.${actionHint}`}
              className={cn(
                "col-span-1 flex flex-col items-center gap-1 rounded-md py-1 transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                !disabled && "cursor-pointer hover:bg-white/10",
                disabled && phase === "playing" && "cursor-not-allowed",
              )}
            >
              {Array.from({ length: ROWS }, (_, row) => {
                const cell = board[row][col];
                const isWinning = winningKeys.has(`${row},${col}`);
                return (
                  <span
                    key={`${row}-${col}`}
                    aria-hidden="true"
                    className={cn(
                      "aspect-square w-full rounded-full",
                      !cell && "bg-background/70",
                      cell === "player" && "bg-red-500",
                      cell === "ai" && "bg-yellow-400",
                      isWinning && "ring-2 ring-primary ring-offset-1 ring-offset-blue-900",
                    )}
                  />
                );
              })}
            </button>
          );
        })}
      </div>

      <div role="status" aria-live="polite" className="flex flex-col items-center gap-1 text-center">
        <p className={cn("text-sm font-bold", phase === "won" ? "text-primary" : "text-foreground")}>{statusMessage}</p>
        {phase !== "playing" && (
          <>
            <button
              type="button"
              onClick={handlePlayAgain}
              className="mt-1 rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-colors hover:opacity-90"
            >
              Play Again
            </button>
            <p className="text-xs text-subtle-foreground">Come back tomorrow for a new daily challenge!</p>
          </>
        )}
      </div>
    </section>
  );
}
