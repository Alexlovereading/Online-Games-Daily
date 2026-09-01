/**
 * Daily Connect Four — pure board logic + seeded AI opponent.
 *
 * Design note: the site has no realtime PVP backend, so "daily challenge"
 * here means "the same AI opponent behavior for every player on a given UTC
 * day," not an identical game (the game still branches on the player's own
 * moves). The AI is a lightweight heuristic — not minimax — that always
 * takes an immediate win, always blocks an immediate loss, and otherwise
 * picks a column via a weighted-random choice biased toward the center.
 * That random choice is seeded from (dateKey, moveNumber) rather than a
 * single RNG instance carried across the whole game, so the AI's behavior
 * at any given board state is reproducible from the day's seed alone —
 * including after a page reload, with no need to persist RNG call counts.
 */

import { getDailySeed, makeSeededRng } from "../../lib/daily";

export const CONNECT_FOUR_SLUG = "connect-four";
export const ROWS = 6;
export const COLS = 7;

export type Player = "player" | "ai";
export type Cell = Player | null;
export type Board = Cell[][]; // board[row][col]; row 0 is the top row.

export function createEmptyBoard(): Board {
  return Array.from({ length: ROWS }, () => Array<Cell>(COLS).fill(null));
}

/** Returns the row a dropped piece would land on for a column, or -1 if the column is full. */
export function getLandingRow(board: Board, col: number): number {
  if (col < 0 || col >= COLS) return -1;
  for (let row = ROWS - 1; row >= 0; row -= 1) {
    if (board[row][col] === null) return row;
  }
  return -1;
}

export function isColumnPlayable(board: Board, col: number): boolean {
  return getLandingRow(board, col) !== -1;
}

export function getValidColumns(board: Board): number[] {
  const columns: number[] = [];
  for (let col = 0; col < COLS; col += 1) {
    if (isColumnPlayable(board, col)) columns.push(col);
  }
  return columns;
}

export function countPieces(board: Board): number {
  let count = 0;
  for (const row of board) {
    for (const cell of row) {
      if (cell) count += 1;
    }
  }
  return count;
}

/** Drops a piece into a column. Returns a new board, or the same reference if the column is full. */
export function dropPiece(board: Board, col: number, player: Player): Board {
  const row = getLandingRow(board, col);
  if (row === -1) return board;
  const next = board.map((r) => [...r]);
  next[row][col] = player;
  return next;
}

const DIRECTIONS: Array<[number, number]> = [
  [0, 1], // horizontal
  [1, 0], // vertical
  [1, 1], // diagonal, down-right
  [1, -1], // diagonal, down-left
];

/** Returns the four coordinates of a winning line, if the board contains one. */
export function getWinningLine(board: Board): Array<[number, number]> | null {
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const player = board[row][col];
      if (!player) continue;
      for (const [dr, dc] of DIRECTIONS) {
        const line: Array<[number, number]> = [[row, col]];
        for (let step = 1; step < 4; step += 1) {
          const r = row + dr * step;
          const c = col + dc * step;
          if (r < 0 || r >= ROWS || c < 0 || c >= COLS || board[r][c] !== player) break;
          line.push([r, c]);
        }
        if (line.length >= 4) return line;
      }
    }
  }
  return null;
}

/** Returns the player who has four in a row, if any. */
export function checkWinner(board: Board): Player | null {
  const line = getWinningLine(board);
  if (!line) return null;
  const [row, col] = line[0];
  return board[row][col];
}

/** True once every column is full (with no winner) — a draw. */
export function isBoardFull(board: Board): boolean {
  return board[0].every((cell) => cell !== null);
}

// Center columns are stronger openings/blocks in Connect Four, so weight
// column selection toward the middle: col index 3 (center) is 4x as likely
// to be picked as the edge columns when no forced move applies.
const CENTER_WEIGHTS = [1, 2, 3, 4, 3, 2, 1];

/**
 * Chooses the AI's column for the current board.
 *
 * `moveNumber` should be the total piece count on `board` at decision time
 * (i.e. after the player's move that triggered this AI turn). Combined with
 * `dateKey`, it seeds the weighted-random fallback so the AI's move at any
 * given (day, board state) is always the same — deterministic without
 * needing to persist RNG state across a session.
 */
export function getAiMove(board: Board, dateKey: string, moveNumber: number): number {
  const validColumns = getValidColumns(board);
  if (validColumns.length === 0) return -1;

  // 1. Take the win if one is available right now.
  for (const col of validColumns) {
    if (checkWinner(dropPiece(board, col, "ai")) === "ai") return col;
  }

  // 2. Otherwise block the player's immediate winning move.
  for (const col of validColumns) {
    if (checkWinner(dropPiece(board, col, "player")) === "player") return col;
  }

  // 3. Otherwise, weighted-random toward the center, seeded by the day + move count.
  const seed = getDailySeed(dateKey, `${CONNECT_FOUR_SLUG}:move:${moveNumber}`);
  const rng = makeSeededRng(seed);
  const weighted: number[] = [];
  for (const col of validColumns) {
    const weight = CENTER_WEIGHTS[col] ?? 1;
    for (let i = 0; i < weight; i += 1) weighted.push(col);
  }
  const pick = Math.floor(rng() * weighted.length);
  return weighted[Math.min(pick, weighted.length - 1)];
}
