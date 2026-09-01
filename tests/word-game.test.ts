import { describe, expect, it } from "vitest";
import { ALLOWED_GUESSES } from "../data/words/allowed-guesses";
import { WORD_ANSWERS } from "../data/words/answers";
import { Clue, clue } from "../game-engines/word/clue";
import { KEYBOARD_ROWS } from "../game-engines/word/Keyboard";
import {
  createProgress,
  editCurrentGuess,
  restoreProgress,
  selectDailyAnswer,
  shouldIgnorePhysicalKey,
  submitCurrentGuess,
} from "../game-engines/word/state";
import { createGameCompleteEvent } from "../lib/analytics";

describe("curated word data", () => {
  it("meets the phase 2 coverage and integrity contract", () => {
    expect(WORD_ANSWERS.length).toBeGreaterThanOrEqual(90);
    expect(ALLOWED_GUESSES.length).toBeGreaterThanOrEqual(300);
    expect(new Set(WORD_ANSWERS).size).toBe(WORD_ANSWERS.length);
    expect(new Set(ALLOWED_GUESSES).size).toBe(ALLOWED_GUESSES.length);
    expect([...WORD_ANSWERS, ...ALLOWED_GUESSES].every((word) => /^[a-z]{5}$/.test(word))).toBe(true);
    const allowed = new Set(ALLOWED_GUESSES);
    expect(WORD_ANSWERS.every((word) => allowed.has(word))).toBe(true);
  });
});

describe("upstream-derived clue logic", () => {
  it("consumes duplicate letters only as often as they occur in the target", () => {
    expect(clue("allee", "apple").map(({ clue: value }) => value)).toEqual([
      Clue.Correct,
      Clue.Elsewhere,
      Clue.Absent,
      Clue.Absent,
      Clue.Correct,
    ]);
  });
});

describe("upstream-derived keyboard", () => {
  it("contains 26 letters and one of each action without consuming B or E", () => {
    const keys = KEYBOARD_ROWS.flat();
    const letters = keys.filter((key) => /^[a-z]$/.test(key));
    expect(letters).toHaveLength(26);
    expect(new Set(letters).size).toBe(26);
    expect(keys.filter((key) => key === "Enter")).toHaveLength(1);
    expect(keys.filter((key) => key === "Backspace")).toHaveLength(1);
    expect(letters).toContain("b");
    expect(letters).toContain("e");
  });

  it("allows screen and physical keys to continue the same draft", () => {
    const afterScreenKey = editCurrentGuess(createProgress("2026-08-06"), "b");
    const afterPhysicalKey = editCurrentGuess(afterScreenKey, "e");
    const afterPhysicalBackspace = editCurrentGuess(afterPhysicalKey, "Backspace");
    expect(afterScreenKey.currentGuess).toBe("b");
    expect(afterPhysicalKey.currentGuess).toBe("be");
    expect(afterPhysicalBackspace.currentGuess).toBe("b");
    expect(shouldIgnorePhysicalKey("BUTTON", "b")).toBe(false);
    expect(shouldIgnorePhysicalKey("BUTTON", "Backspace")).toBe(false);
    expect(shouldIgnorePhysicalKey("BUTTON", "Enter")).toBe(true);
  });
});

describe("daily word game state", () => {
  it("rejects an unlisted guess without using an attempt", () => {
    const progress = { ...createProgress("2026-08-06"), currentGuess: "zzzzz" };
    const result = submitCurrentGuess(progress, "apple");
    expect(result.kind).toBe("invalid");
    expect(result.progress.guesses).toHaveLength(0);
  });

  it("wins when the accepted guess matches the answer", () => {
    const progress = { ...createProgress("2026-08-06"), currentGuess: "apple" };
    const result = submitCurrentGuess(progress, "apple");
    expect(result.kind).toBe("won");
    expect(result.progress.guesses).toEqual(["apple"]);
  });

  it("loses after the sixth accepted non-matching guess", () => {
    let progress = createProgress("2026-08-06");
    for (const guess of ["beach", "beard", "bench", "berry", "birth", "black"]) {
      const result = submitCurrentGuess({ ...progress, currentGuess: guess }, "apple");
      progress = result.progress;
      if (guess === "black") expect(result.kind).toBe("lost");
    }
    expect(progress.guesses).toHaveLength(6);
  });

  it("selects one deterministic answer per UTC date", () => {
    const first = selectDailyAnswer("2026-08-06");
    expect(first).toBe(selectDailyAnswer("2026-08-06"));
    expect(WORD_ANSWERS).toContain(first);
    expect(selectDailyAnswer("2026-08-07")).not.toBe(first);
  });

  it("never repeats the answer on adjacent UTC dates from 2026 through 2035", () => {
    const start = Date.parse("2026-01-01T00:00:00.000Z");
    const end = Date.parse("2036-01-01T00:00:00.000Z");
    let previous = "";
    for (let time = start; time < end; time += 24 * 60 * 60 * 1000) {
      const dateKey = new Date(time).toISOString().slice(0, 10);
      const answer = selectDailyAnswer(dateKey);
      expect(answer, dateKey).not.toBe(previous);
      previous = answer;
    }
  });

  it("restores valid same-day local progress", () => {
    const raw = JSON.stringify({ dateKey: "2026-08-06", guesses: ["beach"], currentGuess: "ap" });
    expect(restoreProgress(raw, "2026-08-06")).toEqual({
      dateKey: "2026-08-06",
      guesses: ["beach"],
      currentGuess: "ap",
    });
  });

  it("expires progress when the UTC date changes", () => {
    const raw = JSON.stringify({ dateKey: "2026-08-06", guesses: ["beach"], currentGuess: "ap" });
    expect(restoreProgress(raw, "2026-08-07")).toEqual(createProgress("2026-08-07"));
  });

  it("reports a failed game through the game_complete analytics contract", () => {
    expect(createGameCompleteEvent("daily-word-game", "2026-08-06", "lose")).toEqual({
      name: "game_complete",
      slug: "daily-word-game",
      dateKey: "2026-08-06",
      result: "lose",
    });
  });
});
