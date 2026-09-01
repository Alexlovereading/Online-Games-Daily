// Pure, deterministic game logic for the Daily Snake Challenge.
// Kept separate from the React component so it can be unit tested without
// mounting anything. No React, no DOM, no timers in this file.

import { getDailySeed, makeSeededRng } from "../../lib/daily";

export const SNAKE_SLUG = "snake-game";

/** Grid dimensions — the board is a 20x20 square. */
export const GRID_COLS = 20;
export const GRID_ROWS = 20;

/** Number of food items eaten to win the day. */
export const WIN_SCORE = 10;

/**
 * How many food coordinates to pre-generate for the day. Comfortably larger
 * than WIN_SCORE so the runtime never runs out even after skipping a few
 * coordinates that happen to land on the snake's own body.
 */
const FOOD_SEQUENCE_LENGTH = 80;

export type Direction = "up" | "down" | "left" | "right";

/** A single grid cell as [col, row]. */
export type Cell = [number, number];

const DIRECTION_VECTORS: Record<Direction, Cell> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

/**
 * Builds the day's fixed food sequence. Every player who opens the game on
 * the same UTC date sees the exact same sequence of food coordinates because
 * it is derived from a seed based on `dateKey` + the game slug.
 *
 * Coordinates are not filtered against any particular snake position here —
 * runtime code that consumes the sequence should skip an entry (advance to
 * the next index) if the coordinate happens to be occupied by the snake's
 * current body. See `resolveFoodIndex`.
 */
export function generateFoodSequence(dateKey: string): Cell[] {
  const seed = getDailySeed(dateKey, SNAKE_SLUG);
  const rng = makeSeededRng(seed);
  return Array.from({ length: FOOD_SEQUENCE_LENGTH }, (): Cell => {
    const col = Math.floor(rng() * GRID_COLS);
    const row = Math.floor(rng() * GRID_ROWS);
    return [col, row];
  });
}

/** The initial 3-segment snake body, centered on the board, facing right. */
export function createInitialSnakeBody(): Cell[] {
  const cx = Math.floor(GRID_COLS / 2);
  const cy = Math.floor(GRID_ROWS / 2);
  return [
    [cx, cy],
    [cx - 1, cy],
    [cx - 2, cy],
  ];
}

/** Computes the cell a snake head would move into for a given direction. */
export function nextHeadPosition(head: Cell, direction: Direction): Cell {
  const [dx, dy] = DIRECTION_VECTORS[direction];
  return [head[0] + dx, head[1] + dy];
}

/**
 * Moves the snake one step in `direction`. When `grew` is true the tail is
 * kept (the snake gets one segment longer, representing a food eaten this
 * step); otherwise the tail is dropped so the body length stays constant.
 */
export function moveSnake(snakeBody: Cell[], direction: Direction, grew: boolean): Cell[] {
  const newHead = nextHeadPosition(snakeBody[0], direction);
  const newBody = [newHead, ...snakeBody];
  if (!grew) {
    newBody.pop();
  }
  return newBody;
}

/**
 * True if the snake's head is out of bounds or overlapping any other body
 * segment. `gridSize` is the (square) board size along one axis.
 */
export function checkCollision(snakeBody: Cell[], gridSize: number): boolean {
  const [headX, headY] = snakeBody[0];

  if (headX < 0 || headX >= gridSize || headY < 0 || headY >= gridSize) {
    return true;
  }

  for (let i = 1; i < snakeBody.length; i++) {
    if (snakeBody[i][0] === headX && snakeBody[i][1] === headY) {
      return true;
    }
  }

  return false;
}

/** True if `a` and `b` are directly opposite (a 180-degree turn). */
export function isOppositeDirection(a: Direction, b: Direction): boolean {
  return (
    (a === "up" && b === "down") ||
    (a === "down" && b === "up") ||
    (a === "left" && b === "right") ||
    (a === "right" && b === "left")
  );
}

/**
 * Finds the first index at or after `fromIndex` in `sequence` whose
 * coordinate is not currently occupied by the snake's body. Falls back to
 * the last valid index if every remaining coordinate is occupied (should
 * essentially never happen given FOOD_SEQUENCE_LENGTH vs. board size).
 */
export function resolveFoodIndex(sequence: Cell[], fromIndex: number, snakeBody: Cell[]): number {
  const occupied = new Set(snakeBody.map(([x, y]) => `${x},${y}`));

  for (let i = fromIndex; i < sequence.length; i++) {
    const [x, y] = sequence[i];
    if (!occupied.has(`${x},${y}`)) {
      return i;
    }
  }

  return Math.min(fromIndex, sequence.length - 1);
}
