// Single source of truth for per-game leaderboard metrics, consumed by both
// the frontend (lib/leaderboard-client.ts, components/Leaderboard.tsx) and
// the standalone Cloudflare Worker (workers/api.ts) that validates and
// stores submissions. Framework-agnostic on purpose — no Next.js imports —
// so wrangler's bundler can pull it directly into the Worker build.
//
// `min`/`max` are plausibility bounds, not tight anti-cheat: submissions
// outside this range are rejected outright, everything inside is trusted.
// Bounds are derived from each game's actual mechanics (see the comment on
// each entry) — not arbitrary round numbers.

export type MetricDirection = "higher_is_better" | "lower_is_better";

export type LeaderboardGameConfig = {
  /** Leaderboard key — usually the games.json slug, except Sudoku which is
   * split into one leaderboard per difficulty (see daily-sudoku-easy etc). */
  slug: string;
  title: string;
  metricLabel: string;
  unit: "ms" | "s" | "points" | "count";
  direction: MetricDirection;
  min: number;
  max: number;
};

export const LEADERBOARD_GAMES: Record<string, LeaderboardGameConfig> = {
  "cupcake-2048": {
    slug: "cupcake-2048",
    title: "Cupcake 2048",
    metricLabel: "Score",
    unit: "points",
    direction: "higher_is_better",
    min: 0,
    // No hard cap in the merge math; a very generous ceiling well above any
    // realistic single-session score, just to reject obviously fake values.
    max: 500000,
  },
  "2048": {
    slug: "2048",
    title: "Daily 2048",
    metricLabel: "Score",
    unit: "points",
    direction: "higher_is_better",
    min: 0,
    max: 500000,
  },
  "daily-sudoku-easy": {
    slug: "daily-sudoku-easy",
    title: "Daily Sudoku (Easy)",
    metricLabel: "Time",
    unit: "s",
    direction: "lower_is_better",
    // 36 clues, 45 cells to fill — floor accounts for UI interaction time,
    // not raw solving speed.
    min: 15,
    max: 3600,
  },
  "daily-sudoku-medium": {
    slug: "daily-sudoku-medium",
    title: "Daily Sudoku (Medium)",
    metricLabel: "Time",
    unit: "s",
    direction: "lower_is_better",
    min: 20,
    max: 3600,
  },
  "daily-sudoku-hard": {
    slug: "daily-sudoku-hard",
    title: "Daily Sudoku (Hard)",
    metricLabel: "Time",
    unit: "s",
    direction: "lower_is_better",
    min: 25,
    max: 5400,
  },
  "reaction-test": {
    slug: "reaction-test",
    title: "Daily Reaction Test",
    metricLabel: "Avg reaction time",
    unit: "ms",
    direction: "lower_is_better",
    // Human reaction floor is ~120-150ms even for elite results; 100ms
    // leaves headroom without accepting scripted sub-frame values. Upper
    // bound matches the game's own worst-case (all-false-start) cap.
    min: 100,
    max: 999,
  },
  "spelling-bee": {
    slug: "spelling-bee",
    title: "Daily Spelling Bee",
    metricLabel: "Score",
    unit: "points",
    direction: "higher_is_better",
    min: 0,
    // The true daily ceiling is puzzle-dependent (computeMaxScore in the
    // engine); this is a static bound well above any real day's max
    // (longest words run ~8 letters, ~28 words/day, plus pangram bonus).
    max: 300,
  },
  "word-search": {
    slug: "word-search",
    title: "Daily Word Search",
    metricLabel: "Time",
    unit: "s",
    direction: "lower_is_better",
    min: 8,
    max: 3600,
  },
  waffle: {
    slug: "waffle",
    title: "Daily Waffle",
    metricLabel: "Swaps used",
    unit: "count",
    direction: "lower_is_better",
    // Hard game rule: 15 swaps max, so 0-15 is the entire legal range.
    min: 0,
    max: 15,
  },
  "snake-game": {
    slug: "snake-game",
    title: "Daily Snake Challenge",
    metricLabel: "Food eaten",
    unit: "count",
    direction: "higher_is_better",
    min: 0,
    // The engine only pre-generates 80 food coordinates for the whole day
    // — that's a hard ceiling, not a guess.
    max: 80,
  },
  "capital-quiz": {
    slug: "capital-quiz",
    title: "Daily Capital Quiz",
    metricLabel: "Correct answers",
    unit: "count",
    direction: "higher_is_better",
    min: 0,
    max: 8,
  },
  "daily-word-game": {
    slug: "daily-word-game",
    title: "The Daily Word",
    metricLabel: "Guesses used",
    unit: "count",
    direction: "lower_is_better",
    // Only submitted on a win, so 1-6 is the entire legal range.
    min: 1,
    max: 6,
  },
  minesweeper: {
    slug: "minesweeper",
    title: "Daily Minesweeper",
    metricLabel: "Time",
    unit: "s",
    direction: "lower_is_better",
    min: 3,
    max: 3600,
  },
  "memory-game": {
    slug: "memory-game",
    title: "Daily Memory Table",
    metricLabel: "Moves",
    unit: "count",
    direction: "lower_is_better",
    // 8 pairs — a perfect game (every flip an exact match) is 8 moves.
    min: 8,
    max: 100,
  },
  "connect-four": {
    slug: "connect-four",
    title: "Daily Connect Four",
    metricLabel: "Pieces to win",
    unit: "count",
    direction: "lower_is_better",
    // Total pieces on the board (both players) when the player wins.
    // Fastest possible legal win: player's 4th move with the AI having
    // played 3 in between = 7 pieces. Only submitted on a win.
    min: 7,
    max: 42,
  },
  "daily-word-groups": {
    slug: "daily-word-groups",
    title: "Daily Word Groups",
    metricLabel: "Mistakes",
    unit: "count",
    direction: "lower_is_better",
    // Only submitted on a win (4 mistakes = loss, never recorded).
    min: 0,
    max: 4,
  },
};

export function getLeaderboardConfig(slug: string): LeaderboardGameConfig | null {
  return LEADERBOARD_GAMES[slug] ?? null;
}

export function isPlausibleValue(slug: string, value: number): boolean {
  const cfg = getLeaderboardConfig(slug);
  if (!cfg) return false;
  if (!Number.isFinite(value)) return false;
  return value >= cfg.min && value <= cfg.max;
}

export function formatMetricValue(cfg: LeaderboardGameConfig, value: number): string {
  if (cfg.unit === "ms") return `${value}ms`;
  if (cfg.unit === "s") {
    // Round the total first, then split — rounding minutes/seconds
    // independently can produce e.g. "1:60" for 119.6s instead of "2:00"
    // when the seconds component itself rounds up to 60.
    const totalSeconds = Math.round(value);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return m > 0 ? `${m}:${s.toString().padStart(2, "0")}` : `${s}s`;
  }
  if (cfg.unit === "points") return `${value} pt${value === 1 ? "" : "s"}`;
  return `${value}`;
}
