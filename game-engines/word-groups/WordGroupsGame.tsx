"use client";

/**
 * Adapted from uday-nc/connection-clone-nextjs, MIT © 2025 Uday N. Chakraborty.
 * Commit: 90c0ec73c9efb6025cd623d19b547466d96e54ad
 * Changes: converted to fetch-based daily puzzle loading; added localStorage
 * progress persistence, seeded daily slug, shared stats/analytics integration,
 * and accessible markup.
 */

import { useEffect, useRef, useState } from "react";
import wordGroupsManifest from "../../data/word-groups-manifest.json";
import { createGameCompleteEvent, trackEvent } from "../../lib/analytics";
import { getUtcDateKey, makeReplayKey } from "../../lib/daily";
import { submitLeaderboardScore } from "../../lib/leaderboard-client";
import { completeGame, loadStats, type GameStats } from "../../lib/stats";
import { lsGet, lsSet } from "../../lib/storage";
import type { Category, GamePhase, PuzzleData } from "./types";
import { type SavedProgress, useWordGroups } from "./useWordGroups";

export const WORD_GROUPS_SLUG = "daily-word-groups";

function progressKey(dateKey: string): string {
  return `dgh:word-groups:${dateKey}`;
}

function loadSavedProgress(dateKey: string): SavedProgress | null {
  if (typeof window === "undefined") return null;
  const raw = lsGet(progressKey(dateKey));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SavedProgress;
  } catch {
    return null;
  }
}

const COLOR_LABELS: Record<string, string> = {
  yellow: "Category (difficulty 1)",
  green: "Category (difficulty 2)",
  blue: "Category (difficulty 3)",
  purple: "Category (difficulty 4)",
};

export function WordGroupsGame({ initialDateKey }: { initialDateKey: string }) {
  const [dateKey, setDateKey] = useState("");
  const [puzzleData, setPuzzleData] = useState<PuzzleData | null>(null);
  const [savedProgress, setSavedProgress] = useState<SavedProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [stats, setStats] = useState<GameStats | null>(null);
  const [isReplay, setIsReplay] = useState(false);

  // Guard against recording stats more than once per session.
  const completedRef = useRef(false);

  // On mount: determine today's date key, check localStorage, then fetch puzzle.
  useEffect(() => {
    const today = getUtcDateKey();
    setDateKey(today);
    setStats(loadStats(WORD_GROUPS_SLUG));

    const saved = loadSavedProgress(today);
    setSavedProgress(saved);

    fetch(`/data/word-groups/${today}.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<PuzzleData>;
      })
      .then((data) => {
        setPuzzleData(data);
        setLoading(false);
      })
      .catch(() => {
        setFetchError(true);
        setLoading(false);
      });
  }, []);

  const game = useWordGroups(puzzleData, savedProgress);
  const { words, selected, found, mistakes, maxMistakes, phase, message } = game;

  // Persist progress to localStorage whenever meaningful state changes.
  // Never during a replay round — today's real record must stay untouched.
  useEffect(() => {
    if (!dateKey || !puzzleData || isReplay) return;
    if (found.length === 0 && mistakes === 0 && phase === "playing") return;
    lsSet(
      progressKey(dateKey),
      JSON.stringify({ found, mistakes, phase } satisfies SavedProgress),
    );
  }, [found, mistakes, phase, dateKey, puzzleData, isReplay]);

  // "Play Again": fetches a different, already-authored puzzle from the
  // manifest (there's no generator for this game — puzzles are hand-authored
  // per date) and holds it in memory only, so today's real result in
  // localStorage is never touched. Repeats are possible once the ~31-puzzle
  // bank has been exhausted across replays.
  const handlePlayAgain = () => {
    const others = wordGroupsManifest.dates.filter((d) => d !== dateKey);
    if (others.length === 0) return;
    const pick = others[Math.floor(Math.random() * others.length)];

    setIsReplay(true);
    setLoading(true);
    setFetchError(false);

    fetch(`/data/word-groups/${pick}.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<PuzzleData>;
      })
      .then((data) => {
        setSavedProgress(null);
        setPuzzleData(data);
        setLoading(false);
      })
      .catch(() => {
        setFetchError(true);
        setLoading(false);
      });
  };

  // Record stats once when the game reaches a terminal phase.
  useEffect(() => {
    if (!dateKey || completedRef.current) return;
    if (phase === "won") {
      completedRef.current = true;
      const updated = completeGame(WORD_GROUPS_SLUG, "win", dateKey);
      setStats(updated);
      trackEvent(createGameCompleteEvent(WORD_GROUPS_SLUG, dateKey, "win"));
      void submitLeaderboardScore(WORD_GROUPS_SLUG, dateKey, mistakes);
    } else if (phase === "lost") {
      completedRef.current = true;
      const updated = completeGame(WORD_GROUPS_SLUG, "lose", dateKey);
      setStats(updated);
    }
  }, [phase, dateKey]);

  // Skip stats re-recording if the game was already finished before this session.
  useEffect(() => {
    if (savedProgress?.phase === "won" || savedProgress?.phase === "lost") {
      completedRef.current = true;
    }
  }, [savedProgress]);

  if (loading) {
    return (
      <section className="wg-game" aria-label="Daily Word Groups">
        <p className="wg-loading">Loading today&apos;s puzzle…</p>
      </section>
    );
  }

  if (fetchError || !puzzleData) {
    return (
      <section className="wg-game" aria-label="Daily Word Groups">
        <p className="wg-error">No puzzle available for today. Check back tomorrow!</p>
      </section>
    );
  }

  const mistakesRemaining = maxMistakes - mistakes;

  return (
    <section className="wg-game" aria-label="Daily Word Groups">
      {/* Header */}
      <div className="wg-header">
        <p className="wg-date">
          Today&apos;s Puzzle ·{" "}
          <time dateTime={dateKey || initialDateKey}>{dateKey || initialDateKey} (UTC)</time>
        </p>
        <div className="wg-mistakes" aria-label={`Mistakes remaining: ${mistakesRemaining} of ${maxMistakes}`}>
          <span className="wg-mistakes-label">Mistakes remaining:</span>
          <span className="wg-dots" role="presentation">
            {Array.from({ length: maxMistakes }).map((_, i) => (
              <span
                key={i}
                className={`wg-dot${i < mistakes ? " used" : ""}`}
                aria-hidden="true"
              />
            ))}
          </span>
        </div>
      </div>

      {/* Found categories (revealed) */}
      {found.length > 0 && (
        <div className="wg-found-categories" aria-label="Found categories" aria-live="polite">
          {found.map((cat) => (
            <div
              key={cat.name}
              className={`wg-category ${cat.color}`}
              aria-label={`${cat.name}: ${cat.words.join(", ")}`}
            >
              <span className="wg-category-name">{cat.name}</span>
              <span className="wg-category-words">{cat.words.join(", ")}</span>
            </div>
          ))}
        </div>
      )}

      {/* Word grid */}
      {phase === "playing" && words.length > 0 && (
        <div
          className="wg-grid"
          role="group"
          aria-label="Word tiles — select four that share a theme"
        >
          {words.map((word) => {
            const isSelected = selected.includes(word);
            return (
              <button
                key={word}
                className={`wg-tile${isSelected ? " selected" : ""}`}
                onClick={() => game.toggleWord(word)}
                aria-pressed={isSelected}
                aria-label={word}
              >
                {word}
              </button>
            );
          })}
        </div>
      )}

      {/* Transient message */}
      {message && (
        <div className="wg-message" role="status" aria-live="polite">
          {message}
        </div>
      )}

      {/* Controls */}
      {phase === "playing" && (
        <div className="wg-controls">
          <button
            className="wg-btn"
            onClick={game.shuffleWords}
            aria-label="Shuffle tiles"
          >
            Shuffle
          </button>
          <button
            className="wg-btn wg-btn-submit"
            onClick={game.submitGuess}
            disabled={selected.length !== 4}
            aria-label="Submit selected words"
            aria-disabled={selected.length !== 4}
          >
            Submit
          </button>
        </div>
      )}

      {/* Result overlay */}
      {(phase === "won" || phase === "lost") && (
        <div className="wg-result" role="status" aria-live="polite">
          <div className="wg-complete">
            {phase === "won" ? (
              <>
                <p className="wg-complete-msg">You got it! 🎉</p>
                <p className="wg-complete-sub">
                  Solved with {mistakes} mistake{mistakes !== 1 ? "s" : ""}.
                </p>
              </>
            ) : (
              <>
                <p className="wg-complete-msg">Better luck next time.</p>
                <p className="wg-complete-sub">All groups have been revealed above.</p>
              </>
            )}

            {stats && (
              <dl className="wg-stats" aria-label="Your word groups statistics">
                <div>
                  <dt>Played</dt>
                  <dd>{stats.played}</dd>
                </div>
                <div>
                  <dt>Wins</dt>
                  <dd>{stats.wins}</dd>
                </div>
                <div>
                  <dt>Streak</dt>
                  <dd>{stats.streak}</dd>
                </div>
                <div>
                  <dt>Best streak</dt>
                  <dd>{stats.maxStreak}</dd>
                </div>
              </dl>
            )}

            <button type="button" className="wg-btn wg-btn-submit" onClick={handlePlayAgain}>
              Play Again
            </button>
          </div>
        </div>
      )}

      {/* Accessibility hint */}
      {phase === "playing" && (
        <p className="wg-hint" aria-hidden="true">
          Select four words that share a common theme, then press Submit.
        </p>
      )}
    </section>
  );
}
