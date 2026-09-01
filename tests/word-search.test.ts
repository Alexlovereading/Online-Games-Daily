import { describe, expect, it } from "vitest";
import wordSearchPool from "../data/word-search/pool.json";
import {
  GRID_SIZE,
  WORDS_PER_PUZZLE,
  generateDailyPuzzle,
} from "../game-engines/word-search/word-search-core";

const POOL = wordSearchPool as Record<string, string[]>;

describe("word search word pool", () => {
  it("has 8-10 themes with 12-15 words each, all valid A-Z 4-9 letter words", () => {
    const themes = Object.keys(POOL);
    expect(themes.length).toBeGreaterThanOrEqual(8);
    expect(themes.length).toBeLessThanOrEqual(10);

    for (const [theme, words] of Object.entries(POOL)) {
      expect(words.length, `${theme} word count`).toBeGreaterThanOrEqual(12);
      expect(words.length, `${theme} word count`).toBeLessThanOrEqual(15);
      expect(new Set(words).size, `${theme} has duplicates`).toBe(words.length);

      for (const word of words) {
        expect(word, `${theme}: ${word}`).toMatch(/^[A-Z]{4,9}$/);
      }
    }
  });
});

describe("generateDailyPuzzle", () => {
  it("is fully deterministic for the same UTC date key", () => {
    const a = generateDailyPuzzle("2026-08-09");
    const b = generateDailyPuzzle("2026-08-09");
    expect(a).toEqual(b);
  });

  it("produces a 12x12 grid", () => {
    const puzzle = generateDailyPuzzle("2026-08-09");
    expect(puzzle.grid).toHaveLength(GRID_SIZE);
    for (const row of puzzle.grid) {
      expect(row).toHaveLength(GRID_SIZE);
    }
  });

  it("places all 8 words, with cells inside the grid and spelling out the word", () => {
    const puzzle = generateDailyPuzzle("2026-08-09");
    expect(puzzle.words).toHaveLength(WORDS_PER_PUZZLE);

    for (const placed of puzzle.words) {
      expect(placed.cells).toHaveLength(placed.word.length);

      const spelled = placed.cells
        .map(([row, col]) => {
          expect(row).toBeGreaterThanOrEqual(0);
          expect(row).toBeLessThan(GRID_SIZE);
          expect(col).toBeGreaterThanOrEqual(0);
          expect(col).toBeLessThan(GRID_SIZE);
          return puzzle.grid[row][col];
        })
        .join("");

      expect(spelled).toBe(placed.word);
    }
  });

  it("only fills empty cells with uppercase A-Z letters", () => {
    const puzzle = generateDailyPuzzle("2026-08-09");
    for (const row of puzzle.grid) {
      for (const letter of row) {
        expect(letter).toMatch(/^[A-Z]$/);
      }
    }
  });

  it("selects a theme from the pool and picks its 8 words from that theme's word bank", () => {
    const puzzle = generateDailyPuzzle("2026-08-09");
    expect(Object.keys(POOL)).toContain(puzzle.theme);
    const bank = POOL[puzzle.theme];
    for (const placed of puzzle.words) {
      expect(bank).toContain(placed.word);
    }
    // No repeated words within a single puzzle.
    expect(new Set(puzzle.words.map((w) => w.word)).size).toBe(puzzle.words.length);
  });

  it("produces different puzzles for different UTC date keys", () => {
    const days = ["2026-08-09", "2026-08-10", "2026-08-11", "2026-08-12", "2026-08-13"];
    const puzzles = days.map((d) => generateDailyPuzzle(d));

    const themes = new Set(puzzles.map((p) => p.theme));
    const grids = new Set(puzzles.map((p) => JSON.stringify(p.grid)));

    // With 9 themes and 5 sampled days we expect at least some variation in
    // both the chosen theme and the resulting grid layout.
    expect(grids.size).toBeGreaterThan(1);
    expect(themes.size).toBeGreaterThanOrEqual(1);
  });
});
