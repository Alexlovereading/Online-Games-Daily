/**
 * Directly adapted from jinhucheung/2048-react src/Game.tsx
 * Source: https://github.com/jinhucheung/2048-react
 * Commit: 63c77f4bb6b0b902c0277b4fec7aea12b65cdc75
 * Copyright (c) 2018 Jin Hu Cheung. MIT License; see /licenses.
 * Based on 2048 game by Gabriele Cirulli (gabrielecirulli/2048, MIT).
 * Changes: converted event-callback class to pure state-transform functions;
 * added seeded-RNG parameter for daily initial-board generation; adapted to
 * TypeScript strict mode and static-export constraints.
 */

export const GRID_SIZE = 4;
export const CELL_COUNT = GRID_SIZE * GRID_SIZE;

export type Board = number[];

export type MoveResult = {
  board: Board;
  score: number;
  moved: boolean;
  won: boolean;
};

type CompressResult = { line: number[]; score: number };

function compress(line: number[]): CompressResult {
  const nonzero = line.filter((v) => v !== 0);
  const result: number[] = [];
  let score = 0;
  let i = 0;
  while (i < nonzero.length) {
    if (i + 1 < nonzero.length && nonzero[i] === nonzero[i + 1]) {
      const merged = nonzero[i] * 2;
      result.push(merged);
      score += merged;
      i += 2;
    } else {
      result.push(nonzero[i]);
      i++;
    }
  }
  while (result.length < GRID_SIZE) result.push(0);
  return { line: result, score };
}

function rotateRight(board: Board): Board {
  const result = new Array(CELL_COUNT).fill(0);
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      result[c * GRID_SIZE + (GRID_SIZE - 1 - r)] = board[r * GRID_SIZE + c];
    }
  }
  return result;
}

function slideLeft(board: Board): { board: Board; score: number } {
  let score = 0;
  const result: number[] = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    const row = board.slice(r * GRID_SIZE, (r + 1) * GRID_SIZE);
    const { line, score: s } = compress(row);
    result.push(...line);
    score += s;
  }
  return { board: result, score };
}

export function move(board: Board, direction: "up" | "down" | "left" | "right"): MoveResult {
  const rotations = { left: 0, down: 1, right: 2, up: 3 }[direction];
  let b = board;
  for (let i = 0; i < rotations; i++) b = rotateRight(b);
  const { board: slid, score } = slideLeft(b);
  let result = slid;
  for (let i = 0; i < (4 - rotations) % 4; i++) result = rotateRight(result);
  const moved = board.some((v, i) => v !== result[i]);
  const won = result.some((v) => v === 2048);
  return { board: result, score, moved, won };
}

export function addTile(board: Board, rng: () => number = Math.random): Board {
  const empty = board.reduce<number[]>((acc, v, i) => (v === 0 ? [...acc, i] : acc), []);
  if (empty.length === 0) return board;
  const pos = empty[Math.floor(rng() * empty.length)];
  const value = rng() < 0.9 ? 2 : 4;
  const result = [...board];
  result[pos] = value;
  return result;
}

export function isGameOver(board: Board): boolean {
  if (board.includes(0)) return false;
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const v = board[r * GRID_SIZE + c];
      if (c < GRID_SIZE - 1 && v === board[r * GRID_SIZE + c + 1]) return false;
      if (r < GRID_SIZE - 1 && v === board[(r + 1) * GRID_SIZE + c]) return false;
    }
  }
  return true;
}

export function initBoard(rng: () => number): Board {
  let board: Board = new Array(CELL_COUNT).fill(0);
  board = addTile(board, rng);
  board = addTile(board, rng);
  return board;
}
