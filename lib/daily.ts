const DAY_IN_MS = 24 * 60 * 60 * 1000;

export function getUtcDateKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function fnv1a32(input: string): number {
  let hash = 0x811c9dc5;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
}

export function getDailySeed(dateKey: string, gameSlug: string): number {
  return fnv1a32(`${dateKey}:${gameSlug}`);
}

export function millisecondsUntilNextUtcDay(now = new Date()): number {
  const nextUtcMidnight = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
  );

  return Math.max(0, nextUtcMidnight - now.getTime());
}

// Mulberry32 seeded PRNG — public domain algorithm.
// Returns a function that produces deterministic floats in [0, 1).
export function makeSeededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Synthetic, non-calendar "dateKey-shaped" string for one "Play Again" replay
// round. Safe anywhere a generator expects dateKey, since every consumer
// (getDailySeed and everything built on it) only ever hashes whatever string
// it's given — it never needs to parse as a real UTC date.
// Must NEVER be written to localStorage, passed to isNextUtcDay/getUtcDateKey,
// or used as the dateKey argument to completeGame/createGameCompleteEvent —
// it identifies one in-memory replay round, not a calendar day.
export function makeReplayKey(): string {
  const time = Date.now().toString(36);
  const rand = Math.floor(Math.random() * 1e9).toString(36);
  return `replay:${time}:${rand}`;
}

export function isNextUtcDay(previousDateKey: string, dateKey: string): boolean {
  const previous = Date.parse(`${previousDateKey}T00:00:00.000Z`);
  const current = Date.parse(`${dateKey}T00:00:00.000Z`);

  return Number.isFinite(previous) && Number.isFinite(current) && current - previous === DAY_IN_MS;
}
