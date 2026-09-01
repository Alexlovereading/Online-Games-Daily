import { describe, expect, it } from "vitest";
import { makeSeededRng } from "../lib/daily";
import capitalsData from "../data/trivia/capitals.json";
import { getCapitalDistractors, type CapitalEntry } from "../game-engines/trivia/CapitalQuizGame";

const capitals = capitalsData as CapitalEntry[];

describe("capitals dataset", () => {
  it("has 60 entries", () => {
    expect(capitals).toHaveLength(60);
  });

  it("has non-empty code/country/capital fields on every entry", () => {
    for (const entry of capitals) {
      expect(typeof entry.code).toBe("string");
      expect(entry.code.trim().length).toBeGreaterThan(0);
      expect(typeof entry.country).toBe("string");
      expect(entry.country.trim().length).toBeGreaterThan(0);
      expect(typeof entry.capital).toBe("string");
      expect(entry.capital.trim().length).toBeGreaterThan(0);
    }
  });

  it("has unique country codes", () => {
    const codes = capitals.map((entry) => entry.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe("getCapitalDistractors", () => {
  it("returns exactly 3 choices, none matching the entry's own code", () => {
    const entry = capitals[0];
    const rng = makeSeededRng(42);
    const distractors = getCapitalDistractors(entry, capitals, rng);

    expect(distractors).toHaveLength(3);
    expect(distractors.every((choice) => choice.id !== entry.code)).toBe(true);
  });

  it("returns 3 distinct choices", () => {
    const entry = capitals[5];
    const rng = makeSeededRng(7);
    const distractors = getCapitalDistractors(entry, capitals, rng);

    expect(new Set(distractors.map((choice) => choice.id)).size).toBe(3);
  });

  it("is deterministic for the same seed", () => {
    const entry = capitals[10];
    const first = getCapitalDistractors(entry, capitals, makeSeededRng(123));
    const second = getCapitalDistractors(entry, capitals, makeSeededRng(123));

    expect(first).toEqual(second);
  });

  it("can vary with a different seed", () => {
    const entry = capitals[10];
    const first = getCapitalDistractors(entry, capitals, makeSeededRng(1));
    const second = getCapitalDistractors(entry, capitals, makeSeededRng(999));

    expect(first).not.toEqual(second);
  });
});
