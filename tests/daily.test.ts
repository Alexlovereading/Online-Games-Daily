import { describe, expect, it } from "vitest";
import {
  fnv1a32,
  getDailySeed,
  getUtcDateKey,
  isNextUtcDay,
  makeReplayKey,
  millisecondsUntilNextUtcDay,
} from "../lib/daily";

describe("daily puzzle helpers", () => {
  it("creates the date key in UTC", () => {
    expect(getUtcDateKey(new Date("2026-08-06T23:59:59-07:00"))).toBe("2026-08-07");
  });

  it("uses deterministic unsigned FNV-1a 32-bit seeds", () => {
    expect(fnv1a32("hello")).toBe(1335831723);
    expect(getDailySeed("2026-08-06", "daily-word-game")).toBe(
      getDailySeed("2026-08-06", "daily-word-game"),
    );
    expect(getDailySeed("2026-08-06", "daily-word-game")).not.toBe(
      getDailySeed("2026-08-07", "daily-word-game"),
    );
  });

  it("calculates the next UTC rollover", () => {
    expect(millisecondsUntilNextUtcDay(new Date("2026-08-06T23:59:59.500Z"))).toBe(500);
    expect(isNextUtcDay("2026-08-06", "2026-08-07")).toBe(true);
    expect(isNextUtcDay("2026-08-06", "2026-08-08")).toBe(false);
  });

  it("makes a distinct, non-empty replay key on every call", () => {
    const a = makeReplayKey();
    const b = makeReplayKey();
    expect(a.length).toBeGreaterThan(0);
    expect(b.length).toBeGreaterThan(0);
    expect(a).not.toBe(b);
  });

  it("hashes a fixed replay key deterministically, same as any other dateKey-shaped string", () => {
    const key = "replay:abc:123";
    expect(getDailySeed(key, "waffle")).toBe(getDailySeed(key, "waffle"));
    expect(getDailySeed(key, "waffle")).not.toBe(getDailySeed("2026-08-06", "waffle"));
  });
});
