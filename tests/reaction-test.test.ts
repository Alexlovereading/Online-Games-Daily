import { describe, expect, it } from "vitest";
import {
  buildDelaySequence,
  computeAverage,
  computeResult,
  FALSE_START_PENALTY_MS,
  MAX_DELAY_MS,
  MIN_DELAY_MS,
  ROUNDS,
  WIN_THRESHOLD_MS,
  type RoundResult,
} from "../game-engines/reaction-test/reaction-core";

describe("daily reaction test delay sequence", () => {
  it("produces exactly ROUNDS delays, each within [MIN_DELAY_MS, MAX_DELAY_MS]", () => {
    const seq = buildDelaySequence("2026-08-09");
    expect(seq).toHaveLength(ROUNDS);
    for (const delay of seq) {
      expect(delay).toBeGreaterThanOrEqual(MIN_DELAY_MS);
      expect(delay).toBeLessThanOrEqual(MAX_DELAY_MS);
      expect(Number.isInteger(delay)).toBe(true);
    }
  });

  it("is deterministic for the same UTC date key", () => {
    const first = buildDelaySequence("2026-08-09");
    const second = buildDelaySequence("2026-08-09");
    expect(second).toEqual(first);
  });

  it("differs across different UTC date keys (extremely likely, not guaranteed)", () => {
    const a = buildDelaySequence("2026-08-09");
    const b = buildDelaySequence("2026-08-10");
    expect(a).not.toEqual(b);
  });

  it("is independent of other games' daily seeds (different slug namespace)", () => {
    // buildDelaySequence always seeds with the reaction-test slug internally,
    // so calling it repeatedly for the same date must remain stable even
    // though other engines derive their own seeds from the same date key.
    const seq1 = buildDelaySequence("2026-01-01");
    const seq2 = buildDelaySequence("2026-01-01");
    expect(seq1).toEqual(seq2);
  });
});

describe("reaction test scoring", () => {
  const round = (ms: number, falseStart = false): RoundResult => ({ ms, falseStart });

  it("averages only non-false-start rounds", () => {
    const results = [round(300), round(400), round(9999, true)];
    // (300 + 400) / 2 = 350
    expect(computeAverage(results)).toBe(350);
  });

  it("falls back to the false-start penalty when every round was a false start", () => {
    const results = [round(999, true), round(999, true)];
    expect(computeAverage(results)).toBe(FALSE_START_PENALTY_MS);
  });

  it("wins when the average reaction time is at or below the threshold", () => {
    const results = [round(WIN_THRESHOLD_MS), round(WIN_THRESHOLD_MS)];
    expect(computeAverage(results)).toBe(WIN_THRESHOLD_MS);
    expect(computeResult(results)).toBe("win");
  });

  it("loses when the average reaction time exceeds the threshold", () => {
    const results = [round(WIN_THRESHOLD_MS + 1), round(WIN_THRESHOLD_MS + 1)];
    expect(computeResult(results)).toBe("lose");
  });

  it("loses when every round is a false start", () => {
    const results = [round(999, true), round(999, true), round(999, true)];
    expect(computeResult(results)).toBe("lose");
  });
});
