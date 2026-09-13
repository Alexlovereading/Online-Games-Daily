import { describe, expect, it } from "vitest";
import { makeSeededRng } from "../lib/daily";
import capitalsData from "../data/trivia/capitals.json";
import { getFlagDistractors, type FlagEntry } from "../game-engines/trivia/FlagQuizGame";
import { getCapitalDistractors, type CapitalEntry } from "../game-engines/trivia/CapitalQuizGame";

const capitals = capitalsData as CapitalEntry[];

describe("flag dataset codes", () => {
  // The flag image path is built as `/flags/${code.toLowerCase()}.svg`, so a
  // malformed or duplicated code is a 404 (or a wrong flag) on the live page.
  it("has a two-letter uppercase code on every entry", () => {
    for (const entry of capitals) {
      expect(entry.code).toMatch(/^[A-Z]{2}$/);
    }
  });

  it("has globally unique codes", () => {
    const codes = capitals.map((entry) => entry.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe("getFlagDistractors", () => {
  it("returns exactly 3 choices, none matching the entry's own code", () => {
    const entry = capitals[0];
    const rng = makeSeededRng(42);
    const distractors = getFlagDistractors(entry, capitals, rng);

    expect(distractors).toHaveLength(3);
    expect(distractors.every((choice) => choice.id !== entry.code)).toBe(true);
  });

  it("never includes the correct answer for any entry in the pool", () => {
    for (const [index, entry] of capitals.entries()) {
      const distractors = getFlagDistractors(entry, capitals, makeSeededRng(index));
      expect(distractors.map((choice) => choice.id)).not.toContain(entry.code);
    }
  });

  it("returns 3 distinct choices", () => {
    const entry = capitals[5];
    const rng = makeSeededRng(7);
    const distractors = getFlagDistractors(entry, capitals, rng);

    expect(new Set(distractors.map((choice) => choice.id)).size).toBe(3);
  });

  it("is deterministic for the same seed", () => {
    const entry = capitals[10];
    const first = getFlagDistractors(entry, capitals, makeSeededRng(123));
    const second = getFlagDistractors(entry, capitals, makeSeededRng(123));

    expect(first).toEqual(second);
  });

  it("can vary with a different seed", () => {
    const entry = capitals[10];
    const first = getFlagDistractors(entry, capitals, makeSeededRng(1));
    const second = getFlagDistractors(entry, capitals, makeSeededRng(999));

    expect(first).not.toEqual(second);
  });

  it("labels every choice with the country name, not the capital", () => {
    const byCode = new Map(capitals.map((entry) => [entry.code, entry]));

    for (const [index, entry] of capitals.entries()) {
      const distractors = getFlagDistractors(entry, capitals, makeSeededRng(index));
      for (const choice of distractors) {
        expect(choice.label).toBe(byCode.get(choice.id)?.country);
      }
    }
  });

  it("picks the same countries as the capital quiz for a shared seed but labels them differently", () => {
    const entry = capitals[3];
    const flags = getFlagDistractors(entry, capitals, makeSeededRng(2024));
    const capitalChoices = getCapitalDistractors(entry, capitals, makeSeededRng(2024));

    expect(flags.map((choice) => choice.id)).toEqual(capitalChoices.map((choice) => choice.id));
    expect(flags.map((choice) => choice.label)).not.toEqual(
      capitalChoices.map((choice) => choice.label),
    );
  });

  it("returns what it can from a pool smaller than 4 without throwing", () => {
    const entry: FlagEntry = { code: "US", country: "United States" };
    const tinyPool: FlagEntry[] = [entry, { code: "CA", country: "Canada" }];

    const distractors = getFlagDistractors(entry, tinyPool, makeSeededRng(1));

    expect(distractors).toHaveLength(1);
    expect(distractors[0]).toEqual({ id: "CA", label: "Canada" });
  });

  it("returns an empty list when the pool holds only the entry itself", () => {
    const entry: FlagEntry = { code: "US", country: "United States" };

    expect(getFlagDistractors(entry, [entry], makeSeededRng(1))).toEqual([]);
    expect(getFlagDistractors(entry, [], makeSeededRng(1))).toEqual([]);
  });

  it("handles a three-entry pool deterministically", () => {
    const entry: FlagEntry = { code: "US", country: "United States" };
    const pool: FlagEntry[] = [
      entry,
      { code: "CA", country: "Canada" },
      { code: "MX", country: "Mexico" },
    ];

    const first = getFlagDistractors(entry, pool, makeSeededRng(9));
    const second = getFlagDistractors(entry, pool, makeSeededRng(9));

    expect(first).toHaveLength(2);
    expect(first).toEqual(second);
    expect(new Set(first.map((choice) => choice.id))).toEqual(new Set(["CA", "MX"]));
  });
});
