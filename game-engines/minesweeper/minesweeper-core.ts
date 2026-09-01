/**
 * Daily Minesweeper — core board generation and reveal logic.
 *
 * Design note: this project's daily games must show every player the exact
 * same board for a given UTC day, which conflicts with classic Minesweeper's
 * "first click is always safe" guarantee (that guarantee normally depends on
 * knowing the player's first click before placing mines). The simplified
 * fix used here: the seed generation step permanently reserves the center
 * 3x3 region of the board as a mine-free safe zone, and mines are chosen via
 * a seeded Fisher-Yates shuffle over every other cell. The app always
 * auto-reveals the exact center cell on load, which is guaranteed safe.
 */

import { getDailySeed, makeSeededRng } from "../../lib/daily";

export const MINESWEEPER_SLUG = "minesweeper";
export const BOARD_SIZE = 9;
export const MINE_COUNT = 10;

export type Cell = {
  isMine: boolean;
  adjacentMines: number;
  revealed: boolean;
  flagged: boolean;
};

function inBounds(row: number, col: number): boolean {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

function neighborsOf(row: number, col: number): Array<[number, number]> {
  const neighbors: Array<[number, number]> = [];
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) continue;
      const nr = row + dr;
      const nc = col + dc;
      if (inBounds(nr, nc)) neighbors.push([nr, nc]);
    }
  }
  return neighbors;
}

function isInSafeZone(row: number, col: number): boolean {
  const center = Math.floor(BOARD_SIZE / 2);
  return Math.abs(row - center) <= 1 && Math.abs(col - center) <= 1;
}

/** Fisher–Yates shuffle driven by a deterministic RNG. */
function shuffleWithRng<T>(arr: T[], rng: () => number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Builds today's deterministic minesweeper board — identical for every player on the same UTC day. */
export function generateBoard(dateKey: string): Cell[][] {
  const seed = getDailySeed(dateKey, MINESWEEPER_SLUG);
  const rng = makeSeededRng(seed);

  const candidates: Array<[number, number]> = [];
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      if (!isInSafeZone(row, col)) candidates.push([row, col]);
    }
  }

  const shuffled = shuffleWithRng(candidates, rng);
  const minePositions = new Set(
    shuffled.slice(0, MINE_COUNT).map(([row, col]) => `${row},${col}`),
  );

  const board: Cell[][] = [];
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    const rowCells: Cell[] = [];
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      rowCells.push({
        isMine: minePositions.has(`${row},${col}`),
        adjacentMines: 0,
        revealed: false,
        flagged: false,
      });
    }
    board.push(rowCells);
  }

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      if (board[row][col].isMine) continue;
      let count = 0;
      for (const [nr, nc] of neighborsOf(row, col)) {
        if (board[nr][nc].isMine) count += 1;
      }
      board[row][col].adjacentMines = count;
    }
  }

  return board;
}

/**
 * Reveals a cell, flood-filling connected zero-adjacency cells (and their
 * bordering number cells) when the target cell has no adjacent mines.
 * Returns a new board; does not mutate the input. If the cell is already
 * revealed or flagged, the original board reference is returned unchanged.
 */
export function revealCell(board: Cell[][], row: number, col: number): Cell[][] {
  if (!inBounds(row, col)) return board;
  const target = board[row][col];
  if (target.revealed || target.flagged) return board;

  const next = board.map((r) => r.map((c) => ({ ...c })));

  const stack: Array<[number, number]> = [[row, col]];
  const visited = new Set<string>();

  while (stack.length > 0) {
    const [r, c] = stack.pop()!;
    const key = `${r},${c}`;
    if (visited.has(key)) continue;
    visited.add(key);

    const cell = next[r][c];
    if (cell.revealed || cell.flagged) continue;

    cell.revealed = true;

    if (cell.adjacentMines === 0 && !cell.isMine) {
      for (const [nr, nc] of neighborsOf(r, c)) {
        const neighborCell = next[nr][nc];
        if (!neighborCell.revealed && !neighborCell.flagged) {
          stack.push([nr, nc]);
        }
      }
    }
  }

  return next;
}

/** Toggles the flagged state of a cell. Revealed cells cannot be flagged. */
export function toggleFlag(board: Cell[][], row: number, col: number): Cell[][] {
  if (!inBounds(row, col)) return board;
  const target = board[row][col];
  if (target.revealed) return board;

  const next = board.map((r) => r.map((c) => ({ ...c })));
  next[row][col].flagged = !next[row][col].flagged;
  return next;
}

/** A win is achieved once every non-mine cell has been revealed. */
export function checkWin(board: Cell[][]): boolean {
  for (const row of board) {
    for (const cell of row) {
      if (!cell.isMine && !cell.revealed) return false;
    }
  }
  return true;
}

/** Reveals every mine cell — used to show the full minefield after a loss. */
export function revealAllMines(board: Cell[][]): Cell[][] {
  return board.map((row) =>
    row.map((cell) => (cell.isMine ? { ...cell, revealed: true } : cell)),
  );
}
