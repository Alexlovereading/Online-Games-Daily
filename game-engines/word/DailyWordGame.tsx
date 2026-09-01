"use client";

/**
 * Directly derived and adapted from lynn/hello src/Game.tsx.
 * Source: https://github.com/lynn/hello/blob/835db051e78d0dba4e38bc4b19ae5560b8efbbc3/src/Game.tsx
 * Commit: 835db051e78d0dba4e38bc4b19ae5560b8efbbc3
 * Copyright (c) 2022 Lynn. MIT License; see /NOTICE and /licenses.
 * Changes: fixed five-letter daily mode; removed random/challenge/share/multi-length/
 * hard-mode features; added UTC seed, project word data, localStorage, stats,
 * provider-neutral analytics, and accessible responsive markup.
 */
import { useEffect, useRef, useState } from "react";
import { createGameCompleteEvent, trackEvent } from "../../lib/analytics";
import { getUtcDateKey } from "../../lib/daily";
import { submitLeaderboardScore } from "../../lib/leaderboard-client";
import { lsGet, lsRemove, lsSet } from "../../lib/storage";
import { completeGame, loadStats, type GameStats } from "../../lib/stats";
import { Clue, clue } from "./clue";
import { Keyboard } from "./Keyboard";
import { Row, RowState } from "./Row";
import {
  createProgress,
  editCurrentGuess,
  getGameState,
  MAX_GUESSES,
  restoreProgress,
  selectDailyAnswer,
  shouldIgnorePhysicalKey,
  submitCurrentGuess,
  WORD_GAME_SLUG,
  WORD_LENGTH,
  WORD_PROGRESS_KEY,
  type PersistedWordGame,
} from "./state";

enum GameState {
  Playing,
  Won,
  Lost,
}

function toGameState(progress: PersistedWordGame, target: string): GameState {
  const state = getGameState(progress, target);
  if (state === "won") return GameState.Won;
  if (state === "lost") return GameState.Lost;
  return GameState.Playing;
}

export function DailyWordGame({ initialDateKey }: { initialDateKey: string }) {
  const [dateKey, setDateKey] = useState("");
  const [target, setTarget] = useState("");
  const [progress, setProgress] = useState<PersistedWordGame>(() => createProgress(""));
  const [gameState, setGameState] = useState(GameState.Playing);
  const [hint, setHint] = useState("Find today's five-letter word.");
  const [stats, setStats] = useState<GameStats | null>(null);
  const [ready, setReady] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    const today = getUtcDateKey();
    const answer = selectDailyAnswer(today);
    const restored = restoreProgress(lsGet(WORD_PROGRESS_KEY), today);
    const restoredState = toGameState(restored, answer);
    setDateKey(today);
    setTarget(answer);
    setProgress(restored);
    setGameState(restoredState);
    setStats(loadStats(WORD_GAME_SLUG));
    if (restoredState === GameState.Won) setHint(`Completed in ${restored.guesses.length} guesses.`);
    if (restoredState === GameState.Lost) setHint(`Today's answer was ${answer.toUpperCase()}.`);
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) lsSet(WORD_PROGRESS_KEY, JSON.stringify(progress));
  }, [progress, ready]);

  const resetGame = () => {
    lsRemove(WORD_PROGRESS_KEY);
    started.current = false;
    const fresh = createProgress(dateKey);
    setProgress(fresh);
    setGameState(GameState.Playing);
    setHint("Find today's five-letter word.");
  };

  const markStarted = () => {
    if (!started.current && dateKey) {
      started.current = true;
      trackEvent({ name: "game_start", slug: WORD_GAME_SLUG, dateKey });
    }
  };

  const onKey = (key: string) => {
    if (!ready || gameState !== GameState.Playing) return;
    markStarted();
    if (/^[a-z]$/i.test(key)) {
      setProgress((current) => editCurrentGuess(current, key));
      setHint("");
    } else if (key === "Backspace") {
      setProgress((current) => editCurrentGuess(current, key));
      setHint("");
    } else if (key === "Enter") {
      const submission = submitCurrentGuess(progress, target);
      setHint(submission.message);
      if (submission.kind === "invalid") return;
      setProgress(submission.progress);
      if (submission.kind === "won") {
        setGameState(GameState.Won);
        const updated = completeGame(WORD_GAME_SLUG, "win", dateKey);
        setStats(updated);
        trackEvent(createGameCompleteEvent(WORD_GAME_SLUG, dateKey, "win"));
        void submitLeaderboardScore(WORD_GAME_SLUG, dateKey, submission.progress.guesses.length);
      } else if (submission.kind === "lost") {
        setGameState(GameState.Lost);
        const updated = completeGame(WORD_GAME_SLUG, "lose", dateKey);
        setStats(updated);
        trackEvent(createGameCompleteEvent(WORD_GAME_SLUG, dateKey, "lose"));
      }
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const targetTagName = event.target instanceof HTMLElement ? event.target.tagName : undefined;
      if (shouldIgnorePhysicalKey(targetTagName, event.key)) return;
      if (/^[a-z]$/i.test(event.key) || event.key === "Enter" || event.key === "Backspace") {
        event.preventDefault();
        onKey(event.key);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  });

  const letterInfo = new Map<string, Clue>();
  const tableRows = Array(MAX_GUESSES)
    .fill(undefined)
    .map((_, i) => {
      const guess = [...progress.guesses, progress.currentGuess][i] ?? "";
      const cluedLetters = clue(guess, target);
      const lockedIn = i < progress.guesses.length;
      if (lockedIn) {
        for (const { clue: value, letter } of cluedLetters) {
          if (value === undefined) break;
          const old = letterInfo.get(letter.toUpperCase());
          if (old === undefined || value > old) letterInfo.set(letter.toUpperCase(), value);
        }
      }
      return (
        <Row
          key={i}
          rowNumber={i + 1}
          wordLength={WORD_LENGTH}
          rowState={lockedIn ? RowState.LockedIn : i === progress.guesses.length ? RowState.Editing : RowState.Pending}
          cluedLetters={cluedLetters}
        />
      );
    });

  const finished = gameState !== GameState.Playing;
  return (
    <section className="daily-word-game" aria-label="Daily five-letter word game" data-ready={ready}>
      <div className="Game-meta">
        <p>Today&apos;s puzzle · <time dateTime={dateKey || initialDateKey}>{dateKey || initialDateKey}</time> (UTC)</p>
        <button className="Game-reset-btn" onClick={resetGame} aria-label="Reset today's puzzle">
          New Game
        </button>
        <dl className="Game-stats" aria-label="Your word game statistics">
          <div><dt>Played</dt><dd>{stats?.played ?? 0}</dd></div>
          <div><dt>Wins</dt><dd>{stats?.wins ?? 0}</dd></div>
          <div><dt>Streak</dt><dd>{stats?.streak ?? 0}</dd></div>
        </dl>
      </div>
      <table className="Game-rows" aria-label="Six rows of five letter guesses">
        <tbody>{tableRows}</tbody>
      </table>
      <p className={`Game-message ${finished ? "Game-message-finished" : ""}`} role="status" aria-live="polite">
        {hint || `${MAX_GUESSES - progress.guesses.length} guesses remaining.`}
      </p>
      <Keyboard letterInfo={letterInfo} onKey={onKey} disabled={!ready || finished} />
    </section>
  );
}
