/**
 * Daily Word Search — deterministic puzzle generation.
 *
 * Every player sees the same theme, word list, and letter grid for a given
 * UTC day: the theme and words are chosen from data/word-search/pool.json
 * with a seeded RNG, then placed on a 12x12 grid using the same RNG stream
 * so the whole run is fully reproducible from `dateKey` alone.
 */

import { getDailySeed, makeSeededRng } from "../../lib/daily";
import wordSearchPool from "../../data/word-search/pool.json";

export const WORD_SEARCH_SLUG = "word-search";

export const GRID_SIZE = 12;
export const WORDS_PER_PUZZLE = 8;
const MAX_PLACEMENT_ATTEMPTS = 100;

export type PlacedWord = { word: string; cells: [number, number][] };
export type WordSearchPuzzle = { theme: string; grid: string[][]; words: PlacedWord[] };

const POOL = wordSearchPool as Record<string, string[]>;

// Only forward-friendly directions so the game stays comfortable on touch
// screens: right, down, and the two downward diagonals. No leftward/upward
// or reversed directions are used during placement (the UI still accepts
// either reading direction when checking a player's selection).
const DIRECTIONS: Array<[number, number]> = [
  [0, 1], // horizontal, left to right
  [1, 0], // vertical, top to bottom
  [1, 1], // diagonal, down-right
  [1, -1], // diagonal, down-left
];

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Fisher–Yates shuffle driven by a deterministic RNG. */
function shuffleWithRng<T>(arr: T[], rng: () => number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pickDailyThemeAndWords(dateKey: string, rng: () => number): { theme: string; words: string[] } {
  const themes = Object.keys(POOL).sort();
  const themeIndex = Math.floor(rng() * themes.length);
  const theme = themes[themeIndex];
  const wordBank = POOL[theme];
  const shuffled = shuffleWithRng(wordBank, rng);
  const words = shuffled.slice(0, WORDS_PER_PUZZLE);
  return { theme, words };
}

function inBounds(row: number, col: number): boolean {
  return row >= 0 && row < GRID_SIZE && col >= 0 && col < GRID_SIZE;
}

function tryPlaceWord(
  grid: (string | null)[][],
  word: string,
  rng: () => number,
): [number, number][] | null {
  for (let attempt = 0; attempt < MAX_PLACEMENT_ATTEMPTS; attempt += 1) {
    const [dr, dc] = DIRECTIONS[Math.floor(rng() * DIRECTIONS.length)];
    const startRow = Math.floor(rng() * GRID_SIZE);
    const startCol = Math.floor(rng() * GRID_SIZE);

    const endRow = startRow + dr * (word.length - 1);
    const endCol = startCol + dc * (word.length - 1);
    if (!inBounds(startRow, startCol) || !inBounds(endRow, endCol)) continue;

    const cells: [number, number][] = [];
    let conflict = false;
    for (let i = 0; i < word.length; i += 1) {
      const row = startRow + dr * i;
      const col = startCol + dc * i;
      const existing = grid[row][col];
      if (existing !== null && existing !== word[i]) {
        conflict = true;
        break;
      }
      cells.push([row, col]);
    }
    if (conflict) continue;

    for (let i = 0; i < word.length; i += 1) {
      const [row, col] = cells[i];
      grid[row][col] = word[i];
    }
    return cells;
  }
  return null;
}

/** Builds today's deterministic word search puzzle — identical for every player on the same UTC day. */
export function generateDailyPuzzle(dateKey: string): WordSearchPuzzle {
  const seed = getDailySeed(dateKey, WORD_SEARCH_SLUG);
  const rng = makeSeededRng(seed);

  const { theme, words } = pickDailyThemeAndWords(dateKey, rng);

  const grid: (string | null)[][] = Array.from({ length: GRID_SIZE }, () =>
    Array<string | null>(GRID_SIZE).fill(null),
  );

  // Longest words first — placing them early reduces the chance of running
  // out of conflict-free room on the grid.
  const orderedWords = [...words].sort((a, b) => b.length - a.length);

  const placedWords: PlacedWord[] = [];
  for (const word of orderedWords) {
    const cells = tryPlaceWord(grid, word, rng);
    if (cells) {
      placedWords.push({ word, cells });
    }
  }

  const filledGrid: string[][] = grid.map((row) =>
    row.map((cell) => cell ?? ALPHABET[Math.floor(rng() * ALPHABET.length)]),
  );

  // Preserve the original (pre-sort) word order for display purposes.
  const wordOrderIndex = new Map(words.map((w, i) => [w, i]));
  placedWords.sort((a, b) => (wordOrderIndex.get(a.word) ?? 0) - (wordOrderIndex.get(b.word) ?? 0));

  return { theme, grid: filledGrid, words: placedWords };
}
