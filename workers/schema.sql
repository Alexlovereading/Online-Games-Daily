-- Leaderboard schema for online-games-daily-leaderboard (D1).
-- One row per (slug, date_key, player_id) — a resubmission on the same day
-- updates in place (only if it's actually an improvement), matching the
-- site's existing "one official result per game per UTC day" model. The
-- full history across days is naturally preserved as separate rows, which
-- is what both the daily and all-time leaderboard queries read from.

CREATE TABLE IF NOT EXISTS scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL,
  date_key TEXT NOT NULL,
  player_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  value REAL NOT NULL,
  submitted_at INTEGER NOT NULL,
  -- Placeholder rows seeded so the leaderboard isn't empty before real
  -- traffic arrives. The scheduled() handler in workers/api.ts re-dates
  -- these to the current UTC date every day so they always show up in
  -- "Today" without any manual reseeding — real submissions use date_key
  -- normally and simply rank in alongside them. Delete with
  -- `DELETE FROM scores WHERE is_seed = 1` once real player volume makes
  -- them unnecessary.
  is_seed INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_scores_daily_unique
  ON scores (slug, date_key, player_id);

CREATE INDEX IF NOT EXISTS idx_scores_daily_rank
  ON scores (slug, date_key, value);

CREATE INDEX IF NOT EXISTS idx_scores_alltime_rank
  ON scores (slug, player_id, value);

-- Rate limiting: every submission attempt (accepted or rejected) logs one
-- row here, keyed by a hashed IP (never the raw address). A sliding-window
-- count against this table caps submissions per IP per hour.
CREATE TABLE IF NOT EXISTS submission_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_hash TEXT NOT NULL,
  submitted_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_submission_log_rate
  ON submission_log (ip_hash, submitted_at);
