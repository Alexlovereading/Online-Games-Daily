/**
 * Directly adapted from eqlis/sudoku lib/sudoku/*.ts
 * Source: https://github.com/eqlis/sudoku
 * Commit: 31a6193a871bf82217f83147d5a1851ee007790c
 * Copyright (c) 2026 eqlis. MIT License; see /licenses.
 * Changes: combined multi-file library into single module; added seeded-RNG
 * parameter to generateGrid() for UTC daily mode; removed Next.js persistence
 * and localStorage hooks (handled by project's lib/stats instead).
 */

export const GRID_LENGTH = 9;
const SQUARE_LENGTH = 3;

export type Difficulty = "Easy" | "Medium" | "Hard";

const DIFFICULTY_CLUES: Record<Difficulty, number> = {
  Easy: 36,
  Medium: 30,
  Hard: 24,
};

class SudokuState {
  grid: number[][];
  private rows: boolean[][];
  private cols: boolean[][];
  private boxes: boolean[][];

  private constructor(grid: number[][]) {
    this.grid = grid.map((r) => [...r]);
    this.rows = Array.from({ length: GRID_LENGTH }, () => new Array(GRID_LENGTH + 1).fill(false));
    this.cols = Array.from({ length: GRID_LENGTH }, () => new Array(GRID_LENGTH + 1).fill(false));
    this.boxes = Array.from({ length: GRID_LENGTH }, () => new Array(GRID_LENGTH + 1).fill(false));
    this.init();
  }

  static fromGrid(grid: number[][]): SudokuState {
    return new SudokuState(grid);
  }

  static empty(): SudokuState {
    return new SudokuState(
      Array.from({ length: GRID_LENGTH }, () => new Array(GRID_LENGTH).fill(0)),
    );
  }

  private init() {
    for (let r = 0; r < GRID_LENGTH; r++) {
      for (let c = 0; c < GRID_LENGTH; c++) {
        const v = this.grid[r][c];
        if (v !== 0) {
          const b = this.boxIndex(r, c);
          this.rows[r][v] = true;
          this.cols[c][v] = true;
          this.boxes[b][v] = true;
        }
      }
    }
  }

  boxIndex(row: number, col: number): number {
    return (
      Math.floor(row / SQUARE_LENGTH) * SQUARE_LENGTH +
      Math.floor(col / SQUARE_LENGTH)
    );
  }

  isValid(row: number, col: number, val: number): boolean {
    const b = this.boxIndex(row, col);
    return !this.rows[row][val] && !this.cols[col][val] && !this.boxes[b][val];
  }

  place(row: number, col: number, val: number) {
    const b = this.boxIndex(row, col);
    this.grid[row][col] = val;
    this.rows[row][val] = true;
    this.cols[col][val] = true;
    this.boxes[b][val] = true;
  }

  remove(row: number, col: number) {
    const v = this.grid[row][col];
    const b = this.boxIndex(row, col);
    this.grid[row][col] = 0;
    this.rows[row][v] = false;
    this.cols[col][v] = false;
    this.boxes[b][v] = false;
  }
}

function countSolutions(
  grid: number[][],
  limit: number,
  iterRef?: { n: number },
): number {
  const state = SudokuState.fromGrid(grid);
  let count = 0;

  function recurse(pos: number): void {
    if (iterRef) iterRef.n++;
    if (count >= limit) return;
    if (pos === GRID_LENGTH * GRID_LENGTH) {
      count++;
      return;
    }
    const r = Math.floor(pos / GRID_LENGTH);
    const c = pos % GRID_LENGTH;
    if (state.grid[r][c] !== 0) {
      recurse(pos + 1);
      return;
    }
    for (let v = 1; v <= GRID_LENGTH; v++) {
      if (state.isValid(r, c, v)) {
        state.place(r, c, v);
        recurse(pos + 1);
        state.remove(r, c);
        if (count >= limit) return;
      }
    }
  }

  recurse(0);
  return count;
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const BACKTRACK_CAP = 500_000;

export function generateGrid(
  difficulty: Difficulty,
  rng: () => number,
  _isFallback = false,
): number[][] {
  const state = SudokuState.empty();
  const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  function fill(pos: number): boolean {
    if (pos === GRID_LENGTH * GRID_LENGTH) return true;
    const r = Math.floor(pos / GRID_LENGTH);
    const c = pos % GRID_LENGTH;
    for (const d of shuffle(DIGITS, rng)) {
      if (state.isValid(r, c, d)) {
        state.place(r, c, d);
        if (fill(pos + 1)) return true;
        state.remove(r, c);
      }
    }
    return false;
  }

  fill(0);

  const coords: [number, number][] = [];
  for (let r = 0; r < GRID_LENGTH; r++) {
    for (let c = 0; c < GRID_LENGTH; c++) coords.push([r, c]);
  }

  const target = DIFFICULTY_CLUES[difficulty];
  let remaining = GRID_LENGTH * GRID_LENGTH;
  const iterRef = { n: 0 };

  for (const [r, c] of shuffle(coords, rng)) {
    if (remaining <= target) break;
    if (iterRef.n > BACKTRACK_CAP) {
      // Uniqueness checking is taking too long; fall back to Medium rather
      // than blocking the main thread further.
      if (difficulty === "Hard" && !_isFallback) {
        return generateGrid("Medium", rng, true);
      }
      break;
    }
    const saved = state.grid[r][c];
    state.grid[r][c] = 0;
    if (countSolutions(state.grid, 2, iterRef) === 1) {
      remaining--;
    } else {
      state.grid[r][c] = saved;
    }
  }

  return state.grid.map((row) => [...row]);
}

export function getErrors(puzzle: number[][], board: number[][]): Set<string> {
  const errors = new Set<string>();
  for (let r = 0; r < GRID_LENGTH; r++) {
    for (let c = 0; c < GRID_LENGTH; c++) {
      const v = board[r][c];
      if (v === 0 || puzzle[r][c] !== 0) continue;
      for (let cc = 0; cc < GRID_LENGTH; cc++) {
        if (cc !== c && board[r][cc] === v) {
          errors.add(`${r},${c}`);
          errors.add(`${r},${cc}`);
        }
      }
      for (let rr = 0; rr < GRID_LENGTH; rr++) {
        if (rr !== r && board[rr][c] === v) {
          errors.add(`${r},${c}`);
          errors.add(`${rr},${c}`);
        }
      }
      const br = Math.floor(r / SQUARE_LENGTH) * SQUARE_LENGTH;
      const bc = Math.floor(c / SQUARE_LENGTH) * SQUARE_LENGTH;
      for (let rr = br; rr < br + SQUARE_LENGTH; rr++) {
        for (let cc = bc; cc < bc + SQUARE_LENGTH; cc++) {
          if ((rr !== r || cc !== c) && board[rr][cc] === v) {
            errors.add(`${r},${c}`);
            errors.add(`${rr},${cc}`);
          }
        }
      }
    }
  }
  return errors;
}

export function isBoardComplete(board: number[][], errors: Set<string>): boolean {
  if (errors.size > 0) return false;
  for (let r = 0; r < GRID_LENGTH; r++) {
    for (let c = 0; c < GRID_LENGTH; c++) {
      if (board[r][c] === 0) return false;
    }
  }
  return true;
}
