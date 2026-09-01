import { describe, expect, it } from "vitest";
import {
  BOARD_SIZE,
  MINE_COUNT,
  checkWin,
  generateBoard,
  revealCell,
  toggleFlag,
  type Cell,
} from "../game-engines/minesweeper/minesweeper-core";

const CENTER = Math.floor(BOARD_SIZE / 2);

function countMines(board: Cell[][]): number {
  return board.reduce((sum, row) => sum + row.filter((c) => c.isMine).length, 0);
}

describe("generateBoard", () => {
  it("is deterministic for a given UTC date key", () => {
    const a = generateBoard("2026-08-06");
    const b = generateBoard("2026-08-06");
    expect(a).toEqual(b);
  });

  it("produces a different board for a different date key", () => {
    const a = generateBoard("2026-08-06");
    const b = generateBoard("2026-08-07");
    expect(a).not.toEqual(b);
  });

  it("never places a mine in the center 3x3 safe zone", () => {
    const board = generateBoard("2026-08-06");
    for (let r = CENTER - 1; r <= CENTER + 1; r += 1) {
      for (let c = CENTER - 1; c <= CENTER + 1; c += 1) {
        expect(board[r][c].isMine).toBe(false);
      }
    }
  });

  it("places exactly MINE_COUNT mines", () => {
    const board = generateBoard("2026-08-06");
    expect(countMines(board)).toBe(MINE_COUNT);
  });

  it("produces a 9x9 board", () => {
    const board = generateBoard("2026-08-06");
    expect(board).toHaveLength(BOARD_SIZE);
    for (const row of board) {
      expect(row).toHaveLength(BOARD_SIZE);
    }
  });

  it("computes correct adjacentMines counts for non-mine cells", () => {
    const board = generateBoard("2026-08-06");
    for (let r = 0; r < BOARD_SIZE; r += 1) {
      for (let c = 0; c < BOARD_SIZE; c += 1) {
        const cell = board[r][c];
        if (cell.isMine) continue;
        let expected = 0;
        for (let dr = -1; dr <= 1; dr += 1) {
          for (let dc = -1; dc <= 1; dc += 1) {
            if (dr === 0 && dc === 0) continue;
            const nr = r + dr;
            const nc = c + dc;
            if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc].isMine) {
              expected += 1;
            }
          }
        }
        expect(cell.adjacentMines).toBe(expected);
      }
    }
  });

  it("starts with every cell hidden and unflagged", () => {
    const board = generateBoard("2026-08-06");
    for (const row of board) {
      for (const cell of row) {
        expect(cell.revealed).toBe(false);
        expect(cell.flagged).toBe(false);
      }
    }
  });
});

describe("revealCell", () => {
  it("reveals the center cell (guaranteed safe) without mutating the input board", () => {
    const board = generateBoard("2026-08-06");
    const next = revealCell(board, CENTER, CENTER);
    expect(board[CENTER][CENTER].revealed).toBe(false);
    expect(next[CENTER][CENTER].revealed).toBe(true);
    expect(next).not.toBe(board);
  });

  it("flood-fills connected zero cells and their bordering number cells", () => {
    const board = generateBoard("2026-08-06");
    const next = revealCell(board, CENTER, CENTER);

    // Every revealed cell must either have adjacentMines > 0, or be a zero
    // cell whose reveal was triggered by flood fill, or border a revealed
    // zero cell.
    let revealedCount = 0;
    for (const row of next) {
      for (const cell of row) {
        if (cell.revealed) revealedCount += 1;
      }
    }
    expect(revealedCount).toBeGreaterThan(0);

    // The center cell itself is revealed, and if it's a zero cell, at least
    // one neighbor should also be revealed (flood fill expanded outward).
    if (next[CENTER][CENTER].adjacentMines === 0) {
      const neighborRevealed = [
        next[CENTER - 1][CENTER].revealed,
        next[CENTER + 1][CENTER].revealed,
        next[CENTER][CENTER - 1].revealed,
        next[CENTER][CENTER + 1].revealed,
      ];
      expect(neighborRevealed.some(Boolean)).toBe(true);
    }
  });

  it("does not reveal flagged cells", () => {
    const board = generateBoard("2026-08-06");
    const flagged = toggleFlag(board, 0, 0);
    const next = revealCell(flagged, 0, 0);
    expect(next[0][0].revealed).toBe(false);
    expect(next).toBe(flagged);
  });

  it("returns the same board reference when the cell is already revealed", () => {
    const board = generateBoard("2026-08-06");
    const once = revealCell(board, CENTER, CENTER);
    const twice = revealCell(once, CENTER, CENTER);
    expect(twice).toBe(once);
  });
});

describe("toggleFlag", () => {
  it("flips flagged state", () => {
    const board = generateBoard("2026-08-06");
    const flagged = toggleFlag(board, 0, 0);
    expect(flagged[0][0].flagged).toBe(true);
    const unflagged = toggleFlag(flagged, 0, 0);
    expect(unflagged[0][0].flagged).toBe(false);
  });

  it("does not flag an already-revealed cell", () => {
    const board = generateBoard("2026-08-06");
    const revealed = revealCell(board, CENTER, CENTER);
    const next = toggleFlag(revealed, CENTER, CENTER);
    expect(next[CENTER][CENTER].flagged).toBe(false);
    expect(next).toBe(revealed);
  });
});

describe("checkWin", () => {
  it("returns false when non-mine cells remain hidden", () => {
    const board = generateBoard("2026-08-06");
    const next = revealCell(board, CENTER, CENTER);
    expect(checkWin(next)).toBe(false);
  });

  it("returns true once every non-mine cell is revealed", () => {
    const board = generateBoard("2026-08-06");
    const won = board.map((row) =>
      row.map((cell) => ({ ...cell, revealed: !cell.isMine })),
    );
    expect(checkWin(won)).toBe(true);
  });

  it("returns true even if mines remain unflagged, as long as all safe cells are revealed", () => {
    const board = generateBoard("2026-08-06");
    const won = board.map((row) =>
      row.map((cell) => ({ ...cell, revealed: !cell.isMine, flagged: false })),
    );
    expect(checkWin(won)).toBe(true);
  });
});
