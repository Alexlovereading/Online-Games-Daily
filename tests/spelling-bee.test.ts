import { describe, expect, it } from "vitest";
import puzzlesData from "../data/spelling-bee/puzzles.json";
import {
  computeMaxScore,
  computeWordScore,
  getWinThreshold,
  pickPuzzleIndex,
  validateWord,
  type SpellingBeePuzzle,
} from "../game-engines/spelling-bee/SpellingBeeGame";

const puzzles = puzzlesData as SpellingBeePuzzle[];

describe("spelling bee puzzle dataset", () => {
  it("has at least 30 puzzles", () => {
    expect(puzzles.length).toBeGreaterThanOrEqual(30);
  });

  it("gives every puzzle exactly 7 unique uppercase letters", () => {
    for (const puzzle of puzzles) {
      expect(puzzle.letters).toHaveLength(7);
      expect(new Set(puzzle.letters).size).toBe(7);
      for (const letter of puzzle.letters) {
        expect(letter).toMatch(/^[A-Z]$/);
      }
    }
  });

  it("has a center letter that belongs to the puzzle's letter set", () => {
    for (const puzzle of puzzles) {
      expect(puzzle.letters).toContain(puzzle.center);
    }
  });

  it("has at least 15 valid words per puzzle", () => {
    for (const puzzle of puzzles) {
      expect(puzzle.validWords.length).toBeGreaterThanOrEqual(15);
    }
  });

  it("has unique words within each puzzle's word list", () => {
    for (const puzzle of puzzles) {
      const seen = new Set(puzzle.validWords);
      expect(seen.size).toBe(puzzle.validWords.length);
    }
  });

  it("only uses the puzzle's own 7 letters (repeats allowed) in every valid word", () => {
    for (const puzzle of puzzles) {
      const letterSet = new Set(puzzle.letters);
      for (const word of puzzle.validWords) {
        for (const ch of word) {
          expect(letterSet.has(ch)).toBe(true);
        }
      }
    }
  });

  it("requires every valid word to contain the center letter", () => {
    for (const puzzle of puzzles) {
      for (const word of puzzle.validWords) {
        expect(word.includes(puzzle.center)).toBe(true);
      }
    }
  });

  it("requires every valid word to be at least 4 letters long", () => {
    for (const puzzle of puzzles) {
      for (const word of puzzle.validWords) {
        expect(word.length).toBeGreaterThanOrEqual(4);
      }
    }
  });

  it("has at least one pangram per puzzle, and pangrams are valid words", () => {
    for (const puzzle of puzzles) {
      expect(puzzle.pangrams.length).toBeGreaterThanOrEqual(1);
      for (const pangram of puzzle.pangrams) {
        expect(puzzle.validWords).toContain(pangram);
      }
    }
  });

  it("requires every pangram to use all 7 distinct letters of the puzzle", () => {
    for (const puzzle of puzzles) {
      const letterSet = new Set(puzzle.letters);
      for (const pangram of puzzle.pangrams) {
        const distinctLettersUsed = new Set(pangram.split(""));
        expect(distinctLettersUsed.size).toBe(7);
        for (const ch of distinctLettersUsed) {
          expect(letterSet.has(ch)).toBe(true);
        }
      }
    }
  });
});

describe("pickPuzzleIndex", () => {
  it("is deterministic for the same date key", () => {
    const first = pickPuzzleIndex("2026-08-09", puzzles.length);
    const second = pickPuzzleIndex("2026-08-09", puzzles.length);
    expect(first).toBe(second);
  });

  it("stays within bounds of the puzzle list", () => {
    for (const dateKey of ["2026-01-01", "2026-06-15", "2026-12-31", "2030-02-28"]) {
      const index = pickPuzzleIndex(dateKey, puzzles.length);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(puzzles.length);
    }
  });

  it("can vary across different date keys", () => {
    const indices = new Set(
      Array.from({ length: 30 }, (_, i) => pickPuzzleIndex(`2026-01-${String(i + 1).padStart(2, "0")}`, puzzles.length)),
    );
    expect(indices.size).toBeGreaterThan(1);
  });
});

describe("computeWordScore", () => {
  it("scores a 4-letter word as 1 point", () => {
    expect(computeWordScore("CAST", [])).toBe(1);
  });

  it("scores longer words as 1 point per letter", () => {
    expect(computeWordScore("BLASTS", [])).toBe(6);
  });

  it("adds a 7-point bonus for pangrams", () => {
    expect(computeWordScore("BLASTED", ["BLASTED"])).toBe(14);
  });
});

describe("computeMaxScore and getWinThreshold", () => {
  it("sums every valid word's score", () => {
    const puzzle = puzzles[0];
    const expected = puzzle.validWords.reduce(
      (sum, word) => sum + computeWordScore(word, puzzle.pangrams),
      0,
    );
    expect(computeMaxScore(puzzle)).toBe(expected);
  });

  it("sets the win threshold at 40% of the max score", () => {
    const puzzle = puzzles[0];
    expect(getWinThreshold(puzzle)).toBeCloseTo(computeMaxScore(puzzle) * 0.4);
  });
});

describe("validateWord", () => {
  const puzzle = puzzles.find((p) => p.pangrams.includes("BLASTED"))!;

  it("accepts a valid word from the list", () => {
    const result = validateWord("BLAST", puzzle, []);
    expect(result.ok).toBe(true);
  });

  it("rejects words shorter than 4 letters", () => {
    const result = validateWord("BAT", puzzle, []);
    expect(result.ok).toBe(false);
  });

  it("rejects words using letters outside the hive", () => {
    const result = validateWord("BLASTX", puzzle, []);
    expect(result.ok).toBe(false);
  });

  it("rejects words missing the center letter", () => {
    // "STABLE" contains T but let's test a word without the puzzle's center directly
    const wordWithoutCenter = puzzle.validWords.find((w) => !w.includes(puzzle.center));
    if (wordWithoutCenter) {
      const result = validateWord(wordWithoutCenter, puzzle, []);
      expect(result.ok).toBe(false);
    } else {
      // If every valid word happens to include the center, fabricate a letters-only word to prove the rule.
      const nonCenterLetters = puzzle.letters.filter((l) => l !== puzzle.center);
      const fabricated = (nonCenterLetters[0] ?? "A").repeat(4);
      const result = validateWord(fabricated, puzzle, []);
      expect(result.ok).toBe(false);
    }
  });

  it("rejects words already found this session", () => {
    const result = validateWord("BLAST", puzzle, ["BLAST"]);
    expect(result.ok).toBe(false);
  });

  it("rejects words not in the puzzle's valid word list", () => {
    const result = validateWord("ZZZZ", puzzle, []);
    expect(result.ok).toBe(false);
  });
});
