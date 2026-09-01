"use client";

/**
 * Cupcake 2048 — a cupcake-themed reskin of Daily 2048.
 * Board math (slide/merge/win/loss) is reused verbatim from ../game-2048's
 * algorithm, itself adapted from jinhucheung/2048-react
 * (https://github.com/jinhucheung/2048-react, commit 63c77f4bb6b0b902c0277b4fec7aea12b65cdc75,
 * MIT License), based on 2048 by Gabriele Cirulli (MIT). See /licenses and /NOTICE.
 * The only real change from Daily 2048 is presentation: tiles are rendered
 * as escalating cupcake/cake emoji over a pink-to-gold palette instead of
 * plain numbered tiles, using the site's shared UTC daily-seed, localStorage
 * progress, stats, and analytics infrastructure.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createGameCompleteEvent, trackEvent } from "../../lib/analytics";
import { getDailySeed, makeSeededRng, getUtcDateKey } from "../../lib/daily";
import { submitLeaderboardScore } from "../../lib/leaderboard-client";
import { lsGet, lsSet } from "../../lib/storage";
import { completeGame, loadStats, type GameStats } from "../../lib/stats";
import { addTile, initBoard, isGameOver, move, type Board } from "./game-core";

export const CUPCAKE_2048_SLUG = "cupcake-2048";
const BEST_KEY = "dgh:cupcake2048:best";

type Progress = {
  dateKey: string;
  board: Board;
  score: number;
  over: boolean;
  won: boolean;
  wonContinue: boolean;
};

function progressKey(dk: string) {
  return `dgh:cupcake2048:${dk}`;
}

function buildInitialBoard(dk: string): Board {
  const seed = getDailySeed(dk, CUPCAKE_2048_SLUG);
  return initBoard(makeSeededRng(seed));
}

// Every tile is a cupcake — the emoji "sprinkles" get fancier as the value
// climbs, and the final 2048 tile is the finished birthday cake.
const TILE_EMOJI: Record<number, string> = {
  2: "🧁",
  4: "🧁",
  8: "🧁",
  16: "🍩",
  32: "🍩",
  64: "🍬",
  128: "🍭",
  256: "🍰",
  512: "🍰",
  1024: "🎂",
  2048: "🎂",
};

function tileEmoji(val: number): string {
  return TILE_EMOJI[val] ?? "🎂";
}

function tileClass(val: number): string {
  if (val === 0) return "cup2048-tile cup2048-empty";
  return `cup2048-tile cup2048-tile-${Math.min(val, 2048)}`;
}

export function Cupcake2048Game({ initialDateKey }: { initialDateKey: string }) {
  const [dateKey, setDateKey] = useState("");
  const [board, setBoard] = useState<Board>(new Array(16).fill(0));
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [over, setOver] = useState(false);
  const [won, setWon] = useState(false);
  const [wonContinue, setWonContinue] = useState(false);
  const [stats, setStats] = useState<GameStats | null>(null);
  const [ready, setReady] = useState(false);

  // Refs mirror state so callbacks always read current values without stale closures.
  const boardRef = useRef<Board>(new Array(16).fill(0));
  const scoreRef = useRef(0);
  const overRef = useRef(false);
  const wonRef = useRef(false);
  const wonContinueRef = useRef(false);
  const dateKeyRef = useRef("");
  const started = useRef(false);

  const applyProgress = (p: Progress) => {
    boardRef.current = p.board;
    scoreRef.current = p.score;
    overRef.current = p.over;
    wonRef.current = p.won;
    wonContinueRef.current = p.wonContinue;
    setBoard(p.board);
    setScore(p.score);
    setOver(p.over);
    setWon(p.won);
    setWonContinue(p.wonContinue);
  };

  const persistProgress = useCallback(() => {
    const p: Progress = {
      dateKey: dateKeyRef.current,
      board: boardRef.current,
      score: scoreRef.current,
      over: overRef.current,
      won: wonRef.current,
      wonContinue: wonContinueRef.current,
    };
    lsSet(progressKey(p.dateKey), JSON.stringify(p));
  }, []);

  useEffect(() => {
    const today = getUtcDateKey();
    dateKeyRef.current = today;
    setDateKey(today);

    const savedBest = parseInt(lsGet(BEST_KEY) ?? "0", 10);
    setBest(isNaN(savedBest) ? 0 : savedBest);

    const raw = lsGet(progressKey(today));
    if (raw) {
      try {
        applyProgress(JSON.parse(raw) as Progress);
      } catch {
        const b = buildInitialBoard(today);
        boardRef.current = b;
        setBoard(b);
      }
    } else {
      const b = buildInitialBoard(today);
      boardRef.current = b;
      setBoard(b);
    }

    setStats(loadStats(CUPCAKE_2048_SLUG));
    setReady(true);
  }, []);

  const handleMove = useCallback(
    (direction: "up" | "down" | "left" | "right") => {
      if (!ready || overRef.current || (wonRef.current && !wonContinueRef.current)) return;

      const result = move(boardRef.current, direction);
      if (!result.moved) return;

      if (!started.current && dateKeyRef.current) {
        started.current = true;
        trackEvent({ name: "game_start", slug: CUPCAKE_2048_SLUG, dateKey: dateKeyRef.current });
      }

      const nextBoard = addTile(result.board);
      const newScore = scoreRef.current + result.score;
      const gameOver = isGameOver(nextBoard);
      const justWon = result.won && !wonRef.current;

      boardRef.current = nextBoard;
      scoreRef.current = newScore;
      setBoard(nextBoard);
      setScore(newScore);

      setBest((prev) => {
        const newBest = Math.max(prev, newScore);
        if (newBest > prev) lsSet(BEST_KEY, String(newBest));
        return newBest;
      });

      if (justWon) {
        wonRef.current = true;
        setWon(true);
        persistProgress();
        const updated = completeGame(CUPCAKE_2048_SLUG, "win", dateKeyRef.current);
        setStats(updated);
        trackEvent(createGameCompleteEvent(CUPCAKE_2048_SLUG, dateKeyRef.current, "win"));
        void submitLeaderboardScore(CUPCAKE_2048_SLUG, dateKeyRef.current, newScore);
      } else if (gameOver && !overRef.current) {
        overRef.current = true;
        setOver(true);
        persistProgress();
        const updated = completeGame(CUPCAKE_2048_SLUG, "lose", dateKeyRef.current);
        setStats(updated);
        trackEvent(createGameCompleteEvent(CUPCAKE_2048_SLUG, dateKeyRef.current, "lose"));
        void submitLeaderboardScore(CUPCAKE_2048_SLUG, dateKeyRef.current, newScore);
      } else {
        persistProgress();
      }
    },
    [ready, persistProgress],
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const map: Record<string, "up" | "down" | "left" | "right"> = {
        ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
      };
      if (map[e.key]) { e.preventDefault(); handleMove(map[e.key]); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [handleMove]);

  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;
    touchStart.current = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 30) return;
    handleMove(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
  };

  const resetToday = () => {
    const newBoard = buildInitialBoard(dateKeyRef.current);
    boardRef.current = newBoard;
    scoreRef.current = 0;
    overRef.current = false;
    wonRef.current = false;
    wonContinueRef.current = false;
    started.current = false;
    setBoard(newBoard);
    setScore(0);
    setOver(false);
    setWon(false);
    setWonContinue(false);
    persistProgress();
  };

  return (
    <section
      className="cup2048-game"
      aria-label="Cupcake 2048"
      data-ready={ready}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="cup2048-header">
        <div className="cup2048-title-row">
          <span className="cup2048-logo">🧁 2048</span>
          <div className="cup2048-scores">
            <div className="cup2048-score-box" aria-label={`Score: ${score}`}>
              <span>Score</span>
              <strong>{score}</strong>
            </div>
            <div className="cup2048-score-box" aria-label={`Best: ${best}`}>
              <span>Best</span>
              <strong>{best}</strong>
            </div>
          </div>
        </div>
        <div className="cup2048-meta">
          <p>Today&apos;s batch · <time dateTime={dateKey || initialDateKey}>{dateKey || initialDateKey} (UTC)</time></p>
          <button className="cup2048-new-btn" onClick={resetToday} aria-label="Restart today's board">
            New Batch
          </button>
        </div>
      </div>

      <div
        className="cup2048-board"
        role="grid"
        aria-label="Cupcake 2048 game board, 4 rows by 4 columns"
      >
        {Array.from({ length: 4 }, (_, r) => board.slice(r * 4, r * 4 + 4)).map((rowTiles, r) => (
          <div key={r} role="row" className="a11y-grid-row">
            {rowTiles.map((val, c) => {
              const i = r * 4 + c;
              return (
                <div
                  key={i}
                  className={tileClass(val)}
                  role="gridcell"
                  aria-label={val ? `Cupcake tile ${val}` : "Empty cell"}
                >
                  {val !== 0 && (
                    <>
                      <span className="cup2048-emoji" aria-hidden="true">{tileEmoji(val)}</span>
                      <span className="cup2048-value">{val}</span>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="cup2048-controls" aria-label="Directional controls">
        <button className="cup2048-ctrl-btn" onClick={() => handleMove("up")} aria-label="Move up">↑</button>
        <div className="cup2048-ctrl-row">
          <button className="cup2048-ctrl-btn" onClick={() => handleMove("left")} aria-label="Move left">←</button>
          <button className="cup2048-ctrl-btn" onClick={() => handleMove("down")} aria-label="Move down">↓</button>
          <button className="cup2048-ctrl-btn" onClick={() => handleMove("right")} aria-label="Move right">→</button>
        </div>
      </div>

      <dl className="cup2048-stats" aria-label="Your Cupcake 2048 statistics">
        <div><dt>Played</dt><dd>{stats?.played ?? 0}</dd></div>
        <div><dt>Wins</dt><dd>{stats?.wins ?? 0}</dd></div>
        <div><dt>Streak</dt><dd>{stats?.streak ?? 0}</dd></div>
      </dl>

      {won && !wonContinue && (
        <div className="cup2048-overlay cup2048-won" role="alert" aria-live="assertive">
          <p>You baked the 2048 cake! 🎂</p>
          <div className="cup2048-overlay-btns">
            <button onClick={() => { wonContinueRef.current = true; setWonContinue(true); }}>Keep baking</button>
            <button onClick={resetToday}>New batch</button>
          </div>
        </div>
      )}

      {over && (
        <div className="cup2048-overlay cup2048-over" role="alert" aria-live="assertive">
          <p>Batch over · Score: {score}</p>
          <button onClick={resetToday}>Try again</button>
        </div>
      )}

      <p className="cup2048-hint">Use arrow keys or swipe to slide cupcakes and merge matching pairs.</p>
    </section>
  );
}
