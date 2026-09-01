// Cloudflare Worker entry point. Handles /api/leaderboard/* dynamically
// (backed by D1) and falls through to the static asset binding for every
// other request — the Next.js static export at `out/` is untouched and
// still served exactly as before this Worker existed.
import { getLeaderboardConfig, isPlausibleValue } from "../lib/leaderboard-config";
import { containsBlockedTerm } from "../lib/name-filter";

export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
}

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const PLAYER_ID_RE = /^[a-zA-Z0-9_-]{8,64}$/;
const MAX_NAME_LENGTH = 24;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX_SUBMISSIONS = 60; // per IP per hour, across all games
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

/** Format-checks, then confirms the string round-trips through Date.UTC as
 * the exact same y/m/d — rejects calendar-invalid dates like "9999-99-99"
 * or "2026-02-30" that the regex alone lets through. Safe for read
 * endpoints: browsing a genuinely past day's leaderboard is legitimate,
 * so this does NOT restrict how far from "now" the date is — only that
 * it's a real calendar date. */
function isValidCalendarDate(dateKey: string): boolean {
  if (!DATE_KEY_RE.test(dateKey)) return false;
  const [y, m, d] = dateKey.split("-").map(Number);
  const ms = Date.UTC(y, m - 1, d);
  const roundTrip = new Date(ms);
  return roundTrip.getUTCFullYear() === y && roundTrip.getUTCMonth() === m - 1 && roundTrip.getUTCDate() === d;
}

/** isValidCalendarDate() plus a check that the date is the server's actual
 * current UTC date, or (to cover the narrow window right around midnight
 * where a client's clock reads the previous day) exactly one day earlier
 * — never further back, and NEVER a future date. A previous version of
 * this check allowed a ±2-day window, which let a submission plant fake
 * entries on tomorrow's or the day-after's leaderboard before anyone had
 * actually played that day. Only score submission uses this — reading a
 * genuinely past day's leaderboard (isValidCalendarDate above) is
 * legitimate and stays unrestricted. */
function isValidSubmissionDate(dateKey: string): boolean {
  if (!isValidCalendarDate(dateKey)) return false;
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return dateKey === today || dateKey === yesterday;
}

/** Clamps to [1, MAX_LIMIT], defaulting to DEFAULT_LIMIT for anything
 * missing, non-numeric, non-integer, zero, or negative — `Math.min(n, 100)`
 * alone doesn't reject a negative n, and SQLite treats `LIMIT -1` as "no
 * limit at all", not zero rows. */
function parseLimit(url: URL): number {
  const raw = Number(url.searchParams.get("limit"));
  if (!Number.isInteger(raw) || raw < 1) return DEFAULT_LIMIT;
  return Math.min(raw, MAX_LIMIT);
}

async function hashIp(ip: string): Promise<string> {
  const bytes = new TextEncoder().encode(ip);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function sanitizeName(raw: unknown): string {
  const name = typeof raw === "string" ? raw.trim().slice(0, MAX_NAME_LENGTH) : "";
  if (name.length === 0 || containsBlockedTerm(name)) return "Anonymous";
  return name;
}

/**
 * Atomically checks-and-records one submission for an IP: the INSERT only
 * runs the rows its own WHERE-subquery selects, so the count check and the
 * write happen in a single D1 round trip — two concurrent requests from the
 * same IP can't both read the same under-limit count and both get through,
 * the way two separate check-then-write queries could. Returns false (with
 * nothing written) if the IP is already at the limit — a rejected request
 * must cost nothing, or the limiter itself becomes a free D1-write
 * amplification vector for anyone who keeps hitting it past the limit.
 */
async function tryRecordSubmission(
  db: D1Database,
  ipHash: string,
  now: number,
  since: number,
): Promise<boolean> {
  const result = await db
    .prepare(
      `INSERT INTO submission_log (ip_hash, submitted_at)
       SELECT ?, ?
       WHERE (SELECT COUNT(*) FROM submission_log WHERE ip_hash = ? AND submitted_at > ?) < ?`,
    )
    .bind(ipHash, now, ipHash, since, RATE_LIMIT_MAX_SUBMISSIONS)
    .run();

  const inserted = (result.meta.changes ?? 0) > 0;

  if (inserted) {
    // Opportunistic cleanup of this same IP's own expired rows. This only
    // reaches IPs that submit again — a one-off visitor's single row would
    // sit here forever otherwise, which is what the scheduled() sweep
    // below is for.
    await db
      .prepare("DELETE FROM submission_log WHERE ip_hash = ? AND submitted_at <= ?")
      .bind(ipHash, since)
      .run();
  }

  return inserted;
}

async function handleSubmit(request: Request, env: Env): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ accepted: false, reason: "invalid_json" }, 400);
  }

  const { slug, dateKey, playerId, playerName, value } = (body ?? {}) as Record<string, unknown>;

  if (
    typeof slug !== "string" ||
    typeof dateKey !== "string" ||
    !isValidSubmissionDate(dateKey) ||
    typeof playerId !== "string" ||
    !PLAYER_ID_RE.test(playerId) ||
    typeof value !== "number"
  ) {
    return json({ accepted: false, reason: "invalid_payload" }, 400);
  }

  const cfg = getLeaderboardConfig(slug);
  if (!cfg) return json({ accepted: false, reason: "unknown_game" }, 400);
  if (!isPlausibleValue(slug, value)) {
    return json({ accepted: false, reason: "value_out_of_range" }, 400);
  }

  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  const ipHash = await hashIp(ip);
  const now = Date.now();
  const since = now - RATE_LIMIT_WINDOW_MS;

  if (!(await tryRecordSubmission(env.DB, ipHash, now, since))) {
    return json({ accepted: false, reason: "rate_limited" }, 429);
  }

  const name = sanitizeName(playerName);
  const better = cfg.direction === "higher_is_better" ? "value < ?" : "value > ?";

  // Upsert that only overwrites the existing row if the new value is
  // actually an improvement, per the game's direction — a resubmission
  // that isn't better than today's saved result is silently a no-op.
  await env.DB.prepare(
    `INSERT INTO scores (slug, date_key, player_id, player_name, value, submitted_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(slug, date_key, player_id) DO UPDATE SET
       player_name = excluded.player_name,
       value = excluded.value,
       submitted_at = excluded.submitted_at
     WHERE ${better.replace("value", "scores.value").replace("?", "excluded.value")}`,
  )
    .bind(slug, dateKey, playerId, name, value, now)
    .run();

  const row = await env.DB.prepare("SELECT value FROM scores WHERE slug = ? AND date_key = ? AND player_id = ?")
    .bind(slug, dateKey, playerId)
    .first<{ value: number }>();

  const isPersonalBest = row?.value === value;

  const rankOrder = cfg.direction === "higher_is_better" ? "DESC" : "ASC";
  const rankRow = await env.DB.prepare(
    `SELECT COUNT(*) + 1 AS rank FROM scores
     WHERE slug = ? AND date_key = ? AND value ${cfg.direction === "higher_is_better" ? ">" : "<"} ?`,
  )
    .bind(slug, dateKey, row?.value ?? value)
    .first<{ rank: number }>();

  return json({ accepted: true, isPersonalBest, rank: rankRow?.rank ?? null, savedValue: row?.value ?? value });
}

async function handleDaily(url: URL, env: Env, slug: string): Promise<Response> {
  const cfg = getLeaderboardConfig(slug);
  if (!cfg) return json({ error: "unknown_game" }, 404);

  const dateKey = url.searchParams.get("date");
  if (!dateKey || !isValidCalendarDate(dateKey)) return json({ error: "invalid_date" }, 400);

  const limit = parseLimit(url);
  const order = cfg.direction === "higher_is_better" ? "DESC" : "ASC";

  const { results } = await env.DB.prepare(
    `SELECT player_name AS playerName, value, submitted_at AS submittedAt
     FROM scores WHERE slug = ? AND date_key = ?
     ORDER BY value ${order} LIMIT ?`,
  )
    .bind(slug, dateKey, limit)
    .all<{ playerName: string; value: number; submittedAt: number }>();

  return json({
    slug,
    dateKey,
    direction: cfg.direction,
    entries: (results ?? []).map((r, i) => ({ rank: i + 1, ...r })),
  });
}

async function handleAllTime(url: URL, env: Env, slug: string): Promise<Response> {
  const cfg = getLeaderboardConfig(slug);
  if (!cfg) return json({ error: "unknown_game" }, 404);

  const limit = parseLimit(url);
  const order = cfg.direction === "higher_is_better" ? "DESC" : "ASC";
  // Best single day per player, ranked — not a running total.
  const bestFn = cfg.direction === "higher_is_better" ? "MAX" : "MIN";

  const { results } = await env.DB.prepare(
    `SELECT player_name AS playerName, ${bestFn}(value) AS value
     FROM scores WHERE slug = ?
     GROUP BY player_id
     ORDER BY value ${order} LIMIT ?`,
  )
    .bind(slug, limit)
    .all<{ playerName: string; value: number }>();

  return json({
    slug,
    direction: cfg.direction,
    entries: (results ?? []).map((r, i) => ({ rank: i + 1, ...r })),
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/leaderboard/submit" && request.method === "POST") {
      return handleSubmit(request, env);
    }

    const dailyMatch = url.pathname.match(/^\/api\/leaderboard\/([^/]+)\/daily$/);
    if (dailyMatch && request.method === "GET") {
      return handleDaily(url, env, decodeURIComponent(dailyMatch[1]));
    }

    const allTimeMatch = url.pathname.match(/^\/api\/leaderboard\/([^/]+)\/alltime$/);
    if (allTimeMatch && request.method === "GET") {
      return handleAllTime(url, env, decodeURIComponent(allTimeMatch[1]));
    }

    if (url.pathname.startsWith("/api/")) {
      return json({ error: "not_found" }, 404);
    }

    return env.ASSETS.fetch(request);
  },

  // Global sweep for submission_log rows the per-request cleanup in
  // tryRecordSubmission() can't reach — that one only prunes an IP's own
  // rows when that same IP submits again, so a visitor who hits the
  // endpoint once and never comes back would otherwise sit in the table
  // forever. Runs hourly (see wrangler.jsonc triggers.crons), safely past
  // the 1-hour rate-limit window.
  async scheduled(_event: ScheduledController, env: Env): Promise<void> {
    const cutoff = Date.now() - RATE_LIMIT_WINDOW_MS;
    await env.DB.prepare("DELETE FROM submission_log WHERE submitted_at <= ?").bind(cutoff).run();

    // Keep placeholder rows (is_seed = 1) always showing under "Today"
    // without needing manual reseeding each day. Real submissions already
    // use the real current date_key and simply rank in alongside these
    // once they're re-dated here — no other query logic needs to know
    // about is_seed at all. No-ops on every run except the first one after
    // UTC midnight, since the WHERE clause only matches rows still dated
    // to a previous day. Delete these rows entirely (`DELETE FROM scores
    // WHERE is_seed = 1`) once real player volume makes them unnecessary.
    const today = new Date().toISOString().slice(0, 10);
    const now = Date.now();
    await env.DB.prepare("UPDATE scores SET date_key = ?, submitted_at = ? WHERE is_seed = 1 AND date_key != ?")
      .bind(today, now, today)
      .run();
  },
};
