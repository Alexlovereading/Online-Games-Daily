/**
 * Pure, testable core logic for the Daily Reaction Test game.
 *
 * The per-round "wait for green" delay is derived from the daily seed so every
 * player sees the same sequence of delays on a given UTC day, while still
 * being unable to predict the exact instant each round turns green.
 */

import { getDailySeed, makeSeededRng } from "../../lib/daily";

export const REACTION_TEST_SLUG = "reaction-test";

export const ROUNDS = 5;
export const MIN_DELAY_MS = 1000;
export const MAX_DELAY_MS = 4000;

// Average reaction time (excluding false starts) at or below this threshold
// counts as a win. ~400ms is a generous but meaningful bar above the typical
// human simple-reaction-time range (~200-300ms).
export const WIN_THRESHOLD_MS = 400;

// Recorded as the "reaction time" for a round where the player clicked
// before the box turned green (a false start / jumped the gun).
export const FALSE_START_PENALTY_MS = 999;

export type RoundResult = {
  ms: number;
  falseStart: boolean;
};

/**
 * Deterministically derives the per-round "wait for green" delay (in ms) for
 * a given UTC date key. Same dateKey always yields the same sequence.
 */
export function buildDelaySequence(dateKey: string): number[] {
  const seed = getDailySeed(dateKey, REACTION_TEST_SLUG);
  const rng = makeSeededRng(seed);
  const delays: number[] = [];

  for (let i = 0; i < ROUNDS; i += 1) {
    const delay = MIN_DELAY_MS + rng() * (MAX_DELAY_MS - MIN_DELAY_MS);
    delays.push(Math.round(delay));
  }

  return delays;
}

/**
 * Average reaction time across non-false-start rounds. If every round was a
 * false start, the average falls back to the false-start penalty so the
 * player can't game a "no valid rounds" edge case into a win.
 */
export function computeAverage(results: RoundResult[]): number {
  const valid = results.filter((r) => !r.falseStart);

  if (valid.length === 0) {
    return FALSE_START_PENALTY_MS;
  }

  const sum = valid.reduce((acc, r) => acc + r.ms, 0);
  return Math.round(sum / valid.length);
}

export function computeResult(results: RoundResult[]): "win" | "lose" {
  return computeAverage(results) <= WIN_THRESHOLD_MS ? "win" : "lose";
}
