"use client";

/**
 * Daily Snake Challenge — classic snake, deterministic per-day food order.
 *
 * Original implementation for this project. Every player who opens the game
 * on the same UTC date is fed food coordinates from the exact same seeded
 * sequence (see snake-core.ts), so the run is identical for everyone that
 * day even though it plays out in real time.
 *
 * This is the project's first "live/continuous action" game engine — the
 * game loop runs on a fixed-interval tick rather than advancing on click.
 */

import { useEffect, useRef, useState } from "react";
import { createGameCompleteEvent, trackEvent } from "../../lib/analytics";
import { getUtcDateKey, makeReplayKey } from "../../lib/daily";
import { submitLeaderboardScore } from "../../lib/leaderboard-client";
import { completeGame, type GameResult } from "../../lib/stats";
import { lsGet, lsSet } from "../../lib/storage";
import { cn } from "../../lib/utils";
import {
  checkCollision,
  createInitialSnakeBody,
  type Direction,
  generateFoodSequence,
  GRID_COLS,
  GRID_ROWS,
  isOppositeDirection,
  moveSnake,
  nextHeadPosition,
  resolveFoodIndex,
  SNAKE_SLUG,
  WIN_SCORE,
  type Cell,
} from "./snake-core";

type Phase = "ready" | "playing" | "paused" | "gameover" | "won";

type GameState = {
  snakeBody: Cell[];
  direction: Direction;
  pendingDirection: Direction;
  foodIndex: number;
  score: number;
  phase: Phase;
};

type SavedResult = {
  score: number;
  result: GameResult;
};

const TICK_MS = 150;

function getProgressKey(dateKey: string): string {
  return `dgh:${SNAKE_SLUG}:${dateKey}`;
}

function loadResult(dateKey: string): SavedResult | null {
  if (typeof window === "undefined") return null;
  const raw = lsGet(getProgressKey(dateKey));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SavedResult;
  } catch {
    return null;
  }
}

function saveResult(dateKey: string, result: SavedResult): void {
  if (typeof window === "undefined") return;
  lsSet(getProgressKey(dateKey), JSON.stringify(result));
}

function createIdleState(): GameState {
  return {
    snakeBody: createInitialSnakeBody(),
    direction: "right",
    pendingDirection: "right",
    foodIndex: 0,
    score: 0,
    phase: "ready",
  };
}

/** Advances the game by exactly one tick. Pure given `foodSeq`. */
function tickOnce(prev: GameState, foodSeq: Cell[]): GameState {
  if (prev.phase !== "playing") return prev;

  const direction = prev.pendingDirection;
  const foodCell = foodSeq[Math.min(prev.foodIndex, foodSeq.length - 1)];
  const nextHead = nextHeadPosition(prev.snakeBody[0], direction);
  const willEat = nextHead[0] === foodCell[0] && nextHead[1] === foodCell[1];

  const newBody = moveSnake(prev.snakeBody, direction, willEat);

  if (checkCollision(newBody, GRID_COLS)) {
    return { ...prev, direction, snakeBody: newBody, phase: "gameover" };
  }

  if (willEat) {
    const newScore = prev.score + 1;
    if (newScore >= WIN_SCORE) {
      return { ...prev, direction, snakeBody: newBody, score: newScore, phase: "won" };
    }
    const nextFoodIndex = resolveFoodIndex(foodSeq, prev.foodIndex + 1, newBody);
    return { ...prev, direction, snakeBody: newBody, score: newScore, foodIndex: nextFoodIndex };
  }

  return { ...prev, direction, snakeBody: newBody };
}

export function SnakeGame({ initialDateKey }: { initialDateKey: string }) {
  const [ready, setReady] = useState(false);
  const [dateKey, setDateKey] = useState("");
  const [gameState, setGameState] = useState<GameState>(createIdleState);
  const [replayKey, setReplayKey] = useState<string | null>(null);

  const foodSeqRef = useRef<Cell[]>([]);
  const started = useRef(false);
  const finalized = useRef(false);

  // Bootstrap today's food sequence + any already-saved final result.
  useEffect(() => {
    const today = getUtcDateKey();
    const seq = generateFoodSequence(today);
    const initialBody = createInitialSnakeBody();
    const initialFoodIndex = resolveFoodIndex(seq, 0, initialBody);
    foodSeqRef.current = seq;

    setDateKey(today);

    const saved = loadResult(today);
    if (saved) {
      finalized.current = true;
      setGameState({
        snakeBody: initialBody,
        direction: "right",
        pendingDirection: "right",
        foodIndex: initialFoodIndex,
        score: saved.score,
        phase: saved.result === "win" ? "won" : "gameover",
      });
    } else {
      setGameState({
        snakeBody: initialBody,
        direction: "right",
        pendingDirection: "right",
        foodIndex: initialFoodIndex,
        score: 0,
        phase: "ready",
      });
    }

    setReady(true);
  }, []);

  // Game loop: one tick every TICK_MS while playing.
  useEffect(() => {
    if (gameState.phase !== "playing") return;

    const id = setInterval(() => {
      setGameState((prev) => tickOnce(prev, foodSeqRef.current));
    }, TICK_MS);

    return () => clearInterval(id);
  }, [gameState.phase]);

  // Persist + report the result exactly once per round, the moment it ends.
  // Replay rounds still finalize (so they can't re-trigger this effect
  // mid-round) but never persist or report — only today's real run does.
  useEffect(() => {
    if (!dateKey || finalized.current) return;
    if (gameState.phase !== "gameover" && gameState.phase !== "won") return;

    finalized.current = true;
    if (!replayKey) {
      const result: GameResult = gameState.phase === "won" ? "win" : "lose";
      completeGame(SNAKE_SLUG, result, dateKey);
      trackEvent(createGameCompleteEvent(SNAKE_SLUG, dateKey, result));
      saveResult(dateKey, { score: gameState.score, result });
      void submitLeaderboardScore(SNAKE_SLUG, dateKey, gameState.score);
    }
  }, [gameState.phase, gameState.score, dateKey, replayKey]);

  // "Play Again": a fresh, randomly-generated food sequence held in memory
  // only — today's real result in localStorage is never touched.
  const handlePlayAgain = () => {
    const newKey = makeReplayKey();
    const seq = generateFoodSequence(newKey);
    const initialBody = createInitialSnakeBody();
    const initialFoodIndex = resolveFoodIndex(seq, 0, initialBody);
    foodSeqRef.current = seq;

    finalized.current = false;
    started.current = false;
    setReplayKey(newKey);
    setGameState({
      snakeBody: initialBody,
      direction: "right",
      pendingDirection: "right",
      foodIndex: initialFoodIndex,
      score: 0,
      phase: "ready",
    });
  };

  const handleDirectionInput = (dir: Direction) => {
    setGameState((prev) => {
      if (prev.phase === "gameover" || prev.phase === "won" || prev.phase === "paused") return prev;
      if (isOppositeDirection(dir, prev.direction)) return prev;

      if (!started.current) {
        started.current = true;
        trackEvent({ name: "game_start", slug: SNAKE_SLUG, dateKey });
      }

      return {
        ...prev,
        pendingDirection: dir,
        phase: prev.phase === "ready" ? "playing" : prev.phase,
      };
    });
  };

  const togglePause = () => {
    setGameState((prev) => {
      if (prev.phase === "playing") return { ...prev, phase: "paused" };
      if (prev.phase === "paused") return { ...prev, phase: "playing" };
      return prev;
    });
  };

  // Keyboard controls: arrows / WASD to steer, space to pause.
  useEffect(() => {
    const keyToDirection: Record<string, Direction> = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
      w: "up",
      s: "down",
      a: "left",
      d: "right",
      W: "up",
      S: "down",
      A: "left",
      D: "right",
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === " ") {
        event.preventDefault();
        togglePause();
        return;
      }
      const dir = keyToDirection[event.key];
      if (dir) {
        event.preventDefault();
        handleDirectionInput(dir);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey]);

  if (!ready) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-subtle-foreground">Loading…</p>
      </div>
    );
  }

  const { phase, snakeBody, score } = gameState;
  const isTerminal = phase === "gameover" || phase === "won";

  if (isTerminal) {
    const isWin = phase === "won";
    return (
      <section
        aria-label="Daily Snake Challenge Results"
        className="mx-auto flex max-w-md flex-col items-center gap-3 py-4 text-center"
      >
        <h2 className="font-display text-lg font-semibold text-foreground">Daily Snake Challenge</h2>
        <time dateTime={dateKey || initialDateKey} className="text-xs text-subtle-foreground">
          {dateKey || initialDateKey} (UTC)
        </time>
        <p className="text-4xl font-bold text-primary" aria-label={`Final score: ${score} of ${WIN_SCORE}`}>
          {score}
          <span className="text-xl text-subtle-foreground"> / {WIN_SCORE}</span>
        </p>
        <p className={cn("text-sm font-medium", isWin ? "text-primary" : "text-subtle-foreground")}>
          {isWin ? "You beat today's challenge!" : "Better luck tomorrow!"}
        </p>
        <button
          type="button"
          onClick={handlePlayAgain}
          className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-colors hover:opacity-90"
        >
          Play Again
        </button>
        <p className="text-xs text-subtle-foreground">Come back tomorrow for a new daily run!</p>
      </section>
    );
  }

  const foodCell = foodSeqRef.current[Math.min(gameState.foodIndex, foodSeqRef.current.length - 1)];
  const snakeSet = new Set(snakeBody.map(([x, y]) => `${x},${y}`));
  const headKey = `${snakeBody[0][0]},${snakeBody[0][1]}`;
  const foodKey = foodCell ? `${foodCell[0]},${foodCell[1]}` : "";

  return (
    <section
      aria-label="Daily Snake Challenge"
      className="mx-auto flex w-full max-w-md flex-col items-center gap-3 px-3 py-2 sm:px-0"
    >
      <header className="flex w-full items-center justify-between gap-2">
        <h2 className="font-display text-base font-semibold text-foreground sm:text-lg">Daily Snake Challenge</h2>
        <time dateTime={dateKey || initialDateKey} className="shrink-0 text-xs text-subtle-foreground">
          {dateKey || initialDateKey} (UTC)
        </time>
      </header>

      <div className="flex w-full items-center justify-between text-sm">
        <span className="font-medium text-foreground" aria-live="polite">
          Score: {score} / {WIN_SCORE}
        </span>
        {(phase === "playing" || phase === "paused") && (
          <button
            type="button"
            onClick={togglePause}
            className="rounded-md border border-border bg-subtle px-2 py-1 text-xs font-medium text-foreground hover:bg-subtle/70"
          >
            {phase === "paused" ? "Resume" : "Pause"}
          </button>
        )}
      </div>

      <div
        className="relative w-full overflow-hidden rounded-lg border border-border bg-subtle"
        role="img"
        aria-label={`Snake board, score ${score} of ${WIN_SCORE}`}
      >
        <div
          className="grid aspect-square w-full"
          style={{
            gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
            gridTemplateRows: `repeat(${GRID_ROWS}, 1fr)`,
          }}
        >
          {Array.from({ length: GRID_ROWS }, (_, row) =>
            Array.from({ length: GRID_COLS }, (_, col) => {
              const key = `${col},${row}`;
              const isHead = key === headKey;
              const isBody = !isHead && snakeSet.has(key);
              const isFood = key === foodKey;

              return (
                <div key={key} className="flex items-center justify-center">
                  {isFood && !isBody && !isHead ? (
                    <span className="text-[0.6rem] leading-none sm:text-xs" aria-hidden="true">
                      🍎
                    </span>
                  ) : (
                    <div
                      className={cn(
                        "h-full w-full rounded-sm",
                        isHead && "bg-primary",
                        isBody && "bg-primary/70",
                      )}
                    />
                  )}
                </div>
              );
            }),
          )}
        </div>

        {phase === "paused" && (
          <div className="absolute inset-0 flex items-center justify-center bg-card/80 p-4 text-center">
            <p className="text-sm font-medium text-foreground">Paused — press space or Resume to continue</p>
          </div>
        )}
      </div>

      {phase === "ready" && (
        <p className="text-center text-xs font-medium text-subtle-foreground sm:text-sm">
          Press an arrow key, WASD, or tap a direction button to start
        </p>
      )}

      <div className="mt-1 grid grid-cols-3 gap-3" role="group" aria-label="Direction controls">
        <div />
        <button
          type="button"
          onClick={() => handleDirectionInput("up")}
          className="flex h-14 w-14 items-center justify-center rounded-lg border border-border bg-subtle text-2xl font-medium text-foreground transition-transform hover:bg-subtle/70 active:scale-95 active:bg-primary/20 sm:h-16 sm:w-16"
          aria-label="Move up"
        >
          ↑
        </button>
        <div />

        <button
          type="button"
          onClick={() => handleDirectionInput("left")}
          className="flex h-14 w-14 items-center justify-center rounded-lg border border-border bg-subtle text-2xl font-medium text-foreground transition-transform hover:bg-subtle/70 active:scale-95 active:bg-primary/20 sm:h-16 sm:w-16"
          aria-label="Move left"
        >
          ←
        </button>
        <button
          type="button"
          onClick={() => handleDirectionInput("down")}
          className="flex h-14 w-14 items-center justify-center rounded-lg border border-border bg-subtle text-2xl font-medium text-foreground transition-transform hover:bg-subtle/70 active:scale-95 active:bg-primary/20 sm:h-16 sm:w-16"
          aria-label="Move down"
        >
          ↓
        </button>
        <button
          type="button"
          onClick={() => handleDirectionInput("right")}
          className="flex h-14 w-14 items-center justify-center rounded-lg border border-border bg-subtle text-2xl font-medium text-foreground transition-transform hover:bg-subtle/70 active:scale-95 active:bg-primary/20 sm:h-16 sm:w-16"
          aria-label="Move right"
        >
          →
        </button>
      </div>
    </section>
  );
}
