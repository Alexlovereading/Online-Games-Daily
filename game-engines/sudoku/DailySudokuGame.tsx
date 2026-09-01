"use client";

/**
 * Directly derived and adapted from eqlis/sudoku.
 * Source: https://github.com/eqlis/sudoku
 * Commit: 31a6193a871bf82217f83147d5a1851ee007790c
 * Copyright (c) 2026 eqlis. MIT License; see /licenses and /NOTICE.
 * Changes: built React component shell; added UTC daily seed, difficulty-per-day
 * mode, localStorage progress, shared stats/analytics, and accessible markup.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createGameCompleteEvent, trackEvent } from "../../lib/analytics";
import { Leaderboard } from "../../components/Leaderboard";
import { getDailySeed, makeReplayKey, makeSeededRng, getUtcDateKey } from "../../lib/daily";
import { submitLeaderboardScore } from "../../lib/leaderboard-client";
import { completeGame, loadStats, type GameStats } from "../../lib/stats";
import { lsGet, lsSet } from "../../lib/storage";
import {
  generateGrid,
  getErrors,
  isBoardComplete,
  GRID_LENGTH,
  type Difficulty,
} from "./sudoku-core";

export const SUDOKU_SLUG = "daily-sudoku";
const DIFFICULTIES: Difficulty[] = ["Easy", "Medium", "Hard"];

type Progress = {
  dateKey: string;
  difficulty: Difficulty;
  puzzle: number[][];
  board: number[][];
  elapsed: number;
  complete: boolean;
};

function progressKey(dateKey: string, difficulty: Difficulty) {
  return `dgh:sudoku:${dateKey}:${difficulty.toLowerCase()}`;
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

/** Generates a fresh puzzle for the given key/difficulty — never persists. */
function generateFresh(activeKey: string, difficulty: Difficulty): Progress {
  const seed = getDailySeed(activeKey, `${SUDOKU_SLUG}:${difficulty.toLowerCase()}`);
  const rng = makeSeededRng(seed);
  const puzzle = generateGrid(difficulty, rng);
  const board = puzzle.map((row) => [...row]);
  return { dateKey: activeKey, difficulty, puzzle, board, elapsed: 0, complete: false };
}

function loadOrGenerate(dateKey: string, difficulty: Difficulty): Progress {
  const key = progressKey(dateKey, difficulty);
  const raw = lsGet(key);
  if (raw) {
    try {
      return JSON.parse(raw) as Progress;
    } catch { /* fall through */ }
  }
  const progress = generateFresh(dateKey, difficulty);
  lsSet(key, JSON.stringify(progress));
  return progress;
}

export function DailySudokuGame({ initialDateKey }: { initialDateKey: string }) {
  const [dateKey, setDateKey] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("Medium");
  const [puzzle, setPuzzle] = useState<number[][]>([]);
  const [board, setBoard] = useState<number[][]>([]);
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [complete, setComplete] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [stats, setStats] = useState<GameStats | null>(null);
  const [ready, setReady] = useState(false);
  const [replayKey, setReplayKey] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef(0);
  const started = useRef(false);
  const completedRef = useRef(false);

  const applyProgress = (p: Progress) => {
    setPuzzle(p.puzzle);
    setBoard(p.board);
    setElapsed(p.elapsed);
    elapsedRef.current = p.elapsed;
    setComplete(p.complete);
    completedRef.current = p.complete;
  };

  useEffect(() => {
    const today = getUtcDateKey();
    setDateKey(today);
    setStats(loadStats(SUDOKU_SLUG));

    // Medium might generate quickly; Hard can take ~2-3s so defer to allow "Generating…" UI
    const cached = lsGet(progressKey(today, "Medium"));
    if (cached) {
      try {
        applyProgress(JSON.parse(cached) as Progress);
        setReady(true);
        return;
      } catch { /* fall through */ }
    }

    setGenerating(true);
    setTimeout(() => {
      applyProgress(loadOrGenerate(today, "Medium"));
      setGenerating(false);
      setReady(true);
    }, 0);
  }, []);

  useEffect(() => {
    if (!ready || completedRef.current) return;
    timerRef.current = setInterval(() => {
      elapsedRef.current += 1;
      setElapsed(elapsedRef.current);
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [ready, complete, difficulty]);

  const saveProgress = useCallback(
    (nextBoard: number[][], nextElapsed: number, nextComplete: boolean) => {
      if (!dateKey || puzzle.length === 0 || replayKey) return;
      const p: Progress = { dateKey, difficulty, puzzle, board: nextBoard, elapsed: nextElapsed, complete: nextComplete };
      lsSet(progressKey(dateKey, difficulty), JSON.stringify(p));
    },
    [dateKey, difficulty, puzzle, replayKey],
  );

  const handleChangeDifficulty = (diff: Difficulty) => {
    if (diff === difficulty || !dateKey) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setSelected(null);
    started.current = false;
    setDifficulty(diff);

    // Mid-replay, always regenerate fresh — never read/write the real daily
    // per-difficulty keys while a replay round is active.
    if (replayKey) {
      setGenerating(true);
      setTimeout(() => {
        applyProgress(generateFresh(replayKey, diff));
        setGenerating(false);
      }, 0);
      return;
    }

    const cached = lsGet(progressKey(dateKey, diff));
    if (cached) {
      try {
        applyProgress(JSON.parse(cached) as Progress);
        setReady(true);
        return;
      } catch { /* fall through */ }
    }

    setGenerating(true);
    setTimeout(() => {
      applyProgress(loadOrGenerate(dateKey, diff));
      setGenerating(false);
    }, 0);
  };

  // "Play Again": a fresh, randomly-generated puzzle at the current
  // difficulty, held in memory only — today's real per-difficulty results
  // in localStorage are never touched.
  const handlePlayAgain = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setSelected(null);
    started.current = false;

    const newKey = makeReplayKey();
    setReplayKey(newKey);
    setGenerating(true);
    setTimeout(() => {
      applyProgress(generateFresh(newKey, difficulty));
      setGenerating(false);
    }, 0);
  };

  const handleCellClick = (r: number, c: number) => setSelected([r, c]);

  const handleNumber = useCallback(
    (num: number) => {
      if (!selected || completedRef.current || puzzle.length === 0) return;
      const [r, c] = selected;
      if (puzzle[r][c] !== 0) return;
      if (!started.current && dateKey) {
        started.current = true;
        trackEvent({ name: "game_start", slug: SUDOKU_SLUG, dateKey });
      }
      setBoard((prev) => {
        const next = prev.map((row) => [...row]);
        next[r][c] = num;
        const errors = getErrors(puzzle, next);
        const done = isBoardComplete(next, errors);
        saveProgress(next, elapsedRef.current, done);
        if (done && !completedRef.current) {
          completedRef.current = true;
          setComplete(true);
          if (timerRef.current) clearInterval(timerRef.current);
          if (!replayKey) {
            const updated = completeGame(SUDOKU_SLUG, "win", dateKey);
            setStats(updated);
            trackEvent(createGameCompleteEvent(SUDOKU_SLUG, dateKey, "win"));
            void submitLeaderboardScore(
              `daily-sudoku-${difficulty.toLowerCase()}`,
              dateKey,
              elapsedRef.current,
            );
          }
        }
        return next;
      });
    },
    [selected, puzzle, dateKey, saveProgress, replayKey],
  );

  const handleClear = useCallback(() => {
    if (!selected || completedRef.current || puzzle.length === 0) return;
    const [r, c] = selected;
    if (puzzle[r][c] !== 0) return;
    setBoard((prev) => {
      const next = prev.map((row) => [...row]);
      next[r][c] = 0;
      saveProgress(next, elapsedRef.current, false);
      return next;
    });
  }, [selected, puzzle, saveProgress]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^[1-9]$/.test(e.key)) {
        e.preventDefault();
        handleNumber(parseInt(e.key, 10));
      } else if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") {
        e.preventDefault();
        handleClear();
      } else if (selected) {
        const [r, c] = selected;
        if (e.key === "ArrowUp" && r > 0) { e.preventDefault(); setSelected([r - 1, c]); }
        if (e.key === "ArrowDown" && r < 8) { e.preventDefault(); setSelected([r + 1, c]); }
        if (e.key === "ArrowLeft" && c > 0) { e.preventDefault(); setSelected([r, c - 1]); }
        if (e.key === "ArrowRight" && c < 8) { e.preventDefault(); setSelected([r, c + 1]); }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [handleNumber, handleClear, selected]);

  if (!ready || generating) {
    return (
      <section className="sudoku-game" aria-label="Daily Sudoku">
        <p className="sudoku-loading">Generating today&apos;s puzzle…</p>
        <Leaderboard slug={`daily-sudoku-${difficulty.toLowerCase()}`} dateKey={dateKey || initialDateKey} />
      </section>
    );
  }

  const errors = getErrors(puzzle, board);
  const selectedValue = selected ? board[selected[0]][selected[1]] : 0;

  return (
    <section className="sudoku-game" aria-label="Daily Sudoku" data-ready={ready}>
      <div className="sudoku-meta">
        <p>Today&apos;s puzzle · <time dateTime={dateKey || initialDateKey}>{dateKey || initialDateKey} (UTC)</time></p>
        <div className="sudoku-timer" aria-label={`Elapsed time: ${formatTime(elapsed)}`}>{formatTime(elapsed)}</div>
        <dl className="sudoku-stats" aria-label="Your sudoku statistics">
          <div><dt>Played</dt><dd>{stats?.played ?? 0}</dd></div>
          <div><dt>Wins</dt><dd>{stats?.wins ?? 0}</dd></div>
          <div><dt>Streak</dt><dd>{stats?.streak ?? 0}</dd></div>
        </dl>
      </div>

      <div className="sudoku-difficulty" role="group" aria-label="Choose difficulty">
        {DIFFICULTIES.map((d) => (
          <button
            key={d}
            className={`sudoku-diff-btn${difficulty === d ? " active" : ""}`}
            onClick={() => handleChangeDifficulty(d)}
            aria-pressed={difficulty === d}
          >{d}</button>
        ))}
      </div>

      <div className="sudoku-board" role="grid" aria-label="Sudoku board, 9 rows by 9 columns">
        {board.map((row, r) => (
          <div key={r} className="sudoku-row" role="row">
            {row.map((val, c) => {
              const isGiven = puzzle[r] !== undefined && puzzle[r][c] !== 0;
              const isSelected = selected?.[0] === r && selected?.[1] === c;
              const isError = errors.has(`${r},${c}`);
              const isSameNum = !isSelected && selectedValue !== 0 && val === selectedValue;
              const isRelated =
                !isSelected &&
                selected !== null &&
                (selected[0] === r ||
                  selected[1] === c ||
                  (Math.floor(r / 3) === Math.floor(selected[0] / 3) &&
                    Math.floor(c / 3) === Math.floor(selected[1] / 3)));
              const boxRight = (c + 1) % 3 === 0 && c < 8;
              const boxBottom = (r + 1) % 3 === 0 && r < 8;

              return (
                <button
                  key={c}
                  className={[
                    "sudoku-cell",
                    isGiven ? "given" : "user",
                    isSelected ? "selected" : "",
                    isError ? "error" : "",
                    isSameNum ? "same-num" : "",
                    isRelated ? "related" : "",
                    boxRight ? "box-r" : "",
                    boxBottom ? "box-b" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => handleCellClick(r, c)}
                  aria-label={`Row ${r + 1}, column ${c + 1}${val !== 0 ? `: ${val}` : ", empty"}${isGiven ? " (given)" : ""}`}
                  role="gridcell"
                  tabIndex={isSelected ? 0 : -1}
                >
                  {val !== 0 ? val : ""}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="sudoku-numpad" role="group" aria-label="Number input">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <button
            key={n}
            className="sudoku-num-btn"
            onClick={() => handleNumber(n)}
            aria-label={`Enter ${n}`}
          >{n}</button>
        ))}
        <button
          className="sudoku-num-btn sudoku-erase"
          onClick={handleClear}
          aria-label="Erase selected cell"
        >✕</button>
      </div>

      {complete && (
        <div className="sudoku-complete" role="status" aria-live="polite">
          <p className="sudoku-complete-msg">Solved in {formatTime(elapsed)}!</p>
          <dl className="sudoku-complete-stats">
            <div><dt>Played</dt><dd>{stats?.played ?? 0}</dd></div>
            <div><dt>Wins</dt><dd>{stats?.wins ?? 0}</dd></div>
            <div><dt>Max streak</dt><dd>{stats?.maxStreak ?? 0}</dd></div>
          </dl>
          <button className="sudoku-replay-btn" onClick={handlePlayAgain}>
            Play Again
          </button>
        </div>
      )}

      <p className="sudoku-hint">
        {complete
          ? `${difficulty} · ${GRID_LENGTH}×${GRID_LENGTH}`
          : "Click a cell, then press a number key or use the pad below."}
      </p>

      <Leaderboard slug={`daily-sudoku-${difficulty.toLowerCase()}`} dateKey={dateKey || initialDateKey} />
    </section>
  );
}
