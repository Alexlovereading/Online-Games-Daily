import { describe, expect, it } from "vitest";
import {
  checkCollision,
  createInitialSnakeBody,
  generateFoodSequence,
  GRID_COLS,
  GRID_ROWS,
  isOppositeDirection,
  moveSnake,
  resolveFoodIndex,
  SNAKE_SLUG,
  WIN_SCORE,
  type Cell,
} from "../game-engines/snake/snake-core";

describe("generateFoodSequence", () => {
  it("produces the same sequence for the same UTC date every time", () => {
    const first = generateFoodSequence("2026-08-09");
    const second = generateFoodSequence("2026-08-09");
    expect(first).toEqual(second);
  });

  it("produces a different sequence on a different UTC date", () => {
    const day1 = generateFoodSequence("2026-08-09");
    const day2 = generateFoodSequence("2026-08-10");
    expect(day1).not.toEqual(day2);
  });

  it("returns a sequence comfortably longer than WIN_SCORE, within grid bounds", () => {
    const seq = generateFoodSequence("2026-08-09");
    expect(seq.length).toBeGreaterThan(WIN_SCORE);
    for (const [col, row] of seq) {
      expect(Number.isInteger(col)).toBe(true);
      expect(Number.isInteger(row)).toBe(true);
      expect(col).toBeGreaterThanOrEqual(0);
      expect(col).toBeLessThan(GRID_COLS);
      expect(row).toBeGreaterThanOrEqual(0);
      expect(row).toBeLessThan(GRID_ROWS);
    }
  });

  it("exposes a stable slug", () => {
    expect(SNAKE_SLUG).toBe("snake-game");
  });
});

describe("moveSnake", () => {
  const body: Cell[] = [
    [5, 5],
    [4, 5],
    [3, 5],
  ];

  it("moves forward without growing: adds a new head and drops the tail", () => {
    const next = moveSnake(body, "right", false);
    expect(next).toEqual([
      [6, 5],
      [5, 5],
      [4, 5],
    ]);
    expect(next).toHaveLength(body.length);
  });

  it("grows when grew is true: adds a new head and keeps every existing segment", () => {
    const next = moveSnake(body, "right", true);
    expect(next).toEqual([
      [6, 5],
      [5, 5],
      [4, 5],
      [3, 5],
    ]);
    expect(next).toHaveLength(body.length + 1);
  });

  it("moves in each direction correctly", () => {
    expect(moveSnake(body, "up", false)[0]).toEqual([5, 4]);
    expect(moveSnake(body, "down", false)[0]).toEqual([5, 6]);
    expect(moveSnake(body, "left", false)[0]).toEqual([4, 5]);
    expect(moveSnake(body, "right", false)[0]).toEqual([6, 5]);
  });
});

describe("checkCollision", () => {
  it("returns false for a snake fully inside the grid, not touching itself", () => {
    const body: Cell[] = [
      [5, 5],
      [4, 5],
      [3, 5],
    ];
    expect(checkCollision(body, GRID_COLS)).toBe(false);
  });

  it("detects a wall collision when the head is out of bounds (negative)", () => {
    const body: Cell[] = [
      [-1, 5],
      [0, 5],
      [1, 5],
    ];
    expect(checkCollision(body, GRID_COLS)).toBe(true);
  });

  it("detects a wall collision when the head is beyond the far edge", () => {
    const body: Cell[] = [
      [GRID_COLS, 5],
      [GRID_COLS - 1, 5],
    ];
    expect(checkCollision(body, GRID_COLS)).toBe(true);
  });

  it("detects a self collision when the head overlaps another body segment", () => {
    const body: Cell[] = [
      [5, 5],
      [6, 5],
      [6, 6],
      [5, 6],
      [5, 5],
    ];
    expect(checkCollision(body, GRID_COLS)).toBe(true);
  });
});

describe("isOppositeDirection", () => {
  it("flags directly reversed directions", () => {
    expect(isOppositeDirection("up", "down")).toBe(true);
    expect(isOppositeDirection("down", "up")).toBe(true);
    expect(isOppositeDirection("left", "right")).toBe(true);
    expect(isOppositeDirection("right", "left")).toBe(true);
  });

  it("does not flag perpendicular or matching directions", () => {
    expect(isOppositeDirection("up", "left")).toBe(false);
    expect(isOppositeDirection("up", "up")).toBe(false);
  });
});

describe("createInitialSnakeBody", () => {
  it("returns a 3-segment body centered on the board", () => {
    const body = createInitialSnakeBody();
    expect(body).toHaveLength(3);
    expect(checkCollision(body, GRID_COLS)).toBe(false);
  });
});

describe("resolveFoodIndex", () => {
  it("returns fromIndex unchanged when that coordinate is free", () => {
    const sequence: Cell[] = [
      [1, 1],
      [2, 2],
    ];
    expect(resolveFoodIndex(sequence, 0, [[9, 9]])).toBe(0);
  });

  it("skips forward past coordinates occupied by the snake", () => {
    const sequence: Cell[] = [
      [1, 1],
      [2, 2],
      [3, 3],
    ];
    const snakeBody: Cell[] = [
      [1, 1],
      [2, 2],
    ];
    expect(resolveFoodIndex(sequence, 0, snakeBody)).toBe(2);
  });
});
