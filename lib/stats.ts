import { getUtcDateKey, isNextUtcDay } from "./daily";
import { lsGet, lsSet } from "./storage";

export type GameResult = "win" | "lose";

export type GameStats = {
  lastDateKey: string;
  streak: number;
  maxStreak: number;
  played: number;
  wins: number;
  lastResult?: GameResult;
};

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function getStatsKey(slug: string): string {
  return `dgh:stats:${slug}`;
}

export function recordGameResult(
  current: GameStats | null,
  dateKey: string,
  result: GameResult,
): GameStats {
  if (current?.lastDateKey === dateKey) {
    return current;
  }

  const continuesStreak =
    result === "win" &&
    current?.lastResult === "win" &&
    isNextUtcDay(current.lastDateKey, dateKey);
  const streak = result === "win" ? (continuesStreak ? current.streak + 1 : 1) : 0;

  return {
    lastDateKey: dateKey,
    streak,
    maxStreak: Math.max(current?.maxStreak ?? 0, streak),
    played: (current?.played ?? 0) + 1,
    wins: (current?.wins ?? 0) + (result === "win" ? 1 : 0),
    lastResult: result,
  };
}

export function loadStats(slug: string, storage?: StorageLike): GameStats | null {
  const key = getStatsKey(slug);
  const raw = storage ? storage.getItem(key) : lsGet(key);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as GameStats;
  } catch {
    return null;
  }
}

export function completeGame(
  slug: string,
  result: GameResult,
  dateKey = getUtcDateKey(),
  storage?: StorageLike,
): GameStats {
  const updated = recordGameResult(loadStats(slug, storage), dateKey, result);
  const key = getStatsKey(slug);

  if (storage) {
    storage.setItem(key, JSON.stringify(updated));
  } else {
    lsSet(key, JSON.stringify(updated));
  }
  return updated;
}
