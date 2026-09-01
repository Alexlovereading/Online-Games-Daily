/**
 * Pure grid logic for the Daily Waffle game — deliberately framework-free so
 * it can be unit tested in isolation from the React component.
 *
 * Grid layout (5x5, 0-indexed row/col):
 *   - "Active" cells are row in {0,2,4} OR col in {0,2,4} (21 cells).
 *   - "Dark" cells are row in {1,3} AND col in {1,3} — (1,1) (1,3) (3,1) (3,3),
 *     the 4 unused corners between the woven words.
 *   - 3 "across" words live at row 0/2/4, spanning all 5 columns.
 *   - 3 "down" words live at col 0/2/4, spanning all 5 rows.
 *   - Cross constraint: across[i][2*j] === down[j][2*i] for i, j in {0,1,2},
 *     i.e. the letter shared by across word i and down word j at their
 *     intersection cell (row=2*i, col=2*j) must agree both ways.
 */
import { getDailySeed, makeSeededRng } from "../../lib/daily";

export type WafflePuzzle = {
  across: [string, string, string];
  down: [string, string, string];
};

/** 5x5 grid of single uppercase letters, or null for the 4 unused dark cells. */
export type WaffleGrid = (string | null)[][];

export type Position = { row: number; col: number };

export type CellStatus = "correct" | "present" | "absent";

export const GRID_SIZE = 5;
export const MAX_SWAPS = 15;
/** Number of random swaps applied to the solution to build the day's starting grid. */
export const SCRAMBLE_SWAP_COUNT = 10;

export function isDarkCell(row: number, col: number): boolean {
  return (row === 1 || row === 3) && (col === 1 || col === 3);
}

export function isActiveCell(row: number, col: number): boolean {
  return !isDarkCell(row, col);
}

export function isAcrossRow(row: number): boolean {
  return row === 0 || row === 2 || row === 4;
}

export function isDownCol(col: number): boolean {
  return col === 0 || col === 2 || col === 4;
}

/** All 21 active cell coordinates, row-major order. */
export function getActiveCells(): Position[] {
  const cells: Position[] = [];
  for (let row = 0; row < GRID_SIZE; row += 1) {
    for (let col = 0; col < GRID_SIZE; col += 1) {
      if (isActiveCell(row, col)) cells.push({ row, col });
    }
  }
  return cells;
}

function cloneGrid(grid: WaffleGrid): WaffleGrid {
  return grid.map((row) => [...row]);
}

/** Builds the fully-solved 5x5 grid (letters in their correct positions) from a puzzle. */
export function buildSolutionGrid(puzzle: WafflePuzzle): WaffleGrid {
  const grid: WaffleGrid = Array.from({ length: GRID_SIZE }, () =>
    Array<string | null>(GRID_SIZE).fill(null),
  );

  for (let row = 0; row < GRID_SIZE; row += 1) {
    for (let col = 0; col < GRID_SIZE; col += 1) {
      if (isDarkCell(row, col)) {
        grid[row][col] = null;
      } else if (isAcrossRow(row)) {
        grid[row][col] = puzzle.across[row / 2][col];
      } else {
        // row is 1 or 3 here, which is only active when col is 0, 2, or 4.
        grid[row][col] = puzzle.down[col / 2][row];
      }
    }
  }

  return grid;
}

/**
 * Produces the day's scrambled starting grid by applying SCRAMBLE_SWAP_COUNT
 * deterministic random letter swaps (seeded from dateKey+slug) to the solved
 * grid. Because a swap is its own inverse, replaying the same swaps in
 * reverse order always returns to the solution — so the scrambled grid is
 * guaranteed solvable within SCRAMBLE_SWAP_COUNT swaps, comfortably under
 * the MAX_SWAPS allowance given to the player.
 */
export function scrambleGrid(
  solutionGrid: WaffleGrid,
  dateKey: string,
  slug: string,
): { grid: WaffleGrid; swapsRemaining: number } {
  const rng = makeSeededRng(getDailySeed(dateKey, slug));
  const grid = cloneGrid(solutionGrid);
  const cells = getActiveCells();

  for (let i = 0; i < SCRAMBLE_SWAP_COUNT; i += 1) {
    const a = cells[Math.floor(rng() * cells.length)];
    const b = cells[Math.floor(rng() * cells.length)];
    const tmp = grid[a.row][a.col];
    grid[a.row][a.col] = grid[b.row][b.col];
    grid[b.row][b.col] = tmp;
  }

  return { grid, swapsRemaining: MAX_SWAPS };
}

/** Returns a new grid with the letters at posA and posB swapped. */
export function swapCells(grid: WaffleGrid, posA: Position, posB: Position): WaffleGrid {
  const next = cloneGrid(grid);
  const tmp = next[posA.row][posA.col];
  next[posA.row][posA.col] = next[posB.row][posB.col];
  next[posB.row][posB.col] = tmp;
  return next;
}

function rank(status: CellStatus): number {
  if (status === "correct") return 2;
  if (status === "present") return 1;
  return 0;
}

/**
 * Wordle-style clue algorithm for a single 5-letter word span: exact matches
 * are consumed first, then remaining letters are matched against whatever
 * target letters weren't already claimed by an exact match (so duplicate
 * letters can't over-count as "present").
 */
function wordCellStatuses(current: string[], target: string[]): CellStatus[] {
  const unclaimed: string[] = [];
  target.forEach((letter, i) => {
    if (current[i] !== letter) unclaimed.push(letter);
  });

  return current.map((letter, i) => {
    if (letter === target[i]) return "correct";
    const idx = unclaimed.indexOf(letter);
    if (idx > -1) {
      unclaimed[idx] = "";
      return "present";
    }
    return "absent";
  });
}

/**
 * Status of a single active cell, compared against the solved grid.
 * A cell at a cross point belongs to both an across word and a down word;
 * in that case the better (greener) of the two statuses wins.
 */
export function getCellStatus(grid: WaffleGrid, solutionGrid: WaffleGrid, pos: Position): CellStatus {
  const { row, col } = pos;
  const statuses: CellStatus[] = [];

  if (isAcrossRow(row)) {
    const current = grid[row] as string[];
    const target = solutionGrid[row] as string[];
    statuses.push(wordCellStatuses(current, target)[col]);
  }

  if (isDownCol(col)) {
    const current = grid.map((r) => r[col]) as string[];
    const target = solutionGrid.map((r) => r[col]) as string[];
    statuses.push(wordCellStatuses(current, target)[row]);
  }

  if (statuses.length === 0) return "absent";
  return statuses.reduce((best, s) => (rank(s) > rank(best) ? s : best));
}

/** True once every active cell matches the solution. */
export function checkSolved(grid: WaffleGrid, solutionGrid: WaffleGrid): boolean {
  for (let row = 0; row < GRID_SIZE; row += 1) {
    for (let col = 0; col < GRID_SIZE; col += 1) {
      if (isDarkCell(row, col)) continue;
      if (grid[row][col] !== solutionGrid[row][col]) return false;
    }
  }
  return true;
}
