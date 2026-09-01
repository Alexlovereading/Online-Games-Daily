"use client";

import { useEffect, useRef, useState } from "react";
import { createGameCompleteEvent, trackEvent } from "../../lib/analytics";
import { getDailySeed, getUtcDateKey, makeReplayKey, makeSeededRng } from "../../lib/daily";
import { submitLeaderboardScore } from "../../lib/leaderboard-client";
import { completeGame } from "../../lib/stats";
import { lsGet, lsSet } from "../../lib/storage";
import puzzlesData from "../../data/spelling-bee/puzzles.json";

export const SPELLING_BEE_SLUG = "spelling-bee";

/** Fraction of the puzzle's total possible score needed to record a "win" for the day. */
export const WIN_SCORE_FRACTION = 0.4;

export type SpellingBeePuzzle = {
  letters: string[];
  center: string;
  validWords: string[];
  pangrams: string[];
};

const PUZZLES = puzzlesData as SpellingBeePuzzle[];

type SavedProgress = {
  foundWords: string[];
  score: number;
  completed: boolean;
};

type FeedbackKind = "success" | "pangram" | "error";
type Feedback = { kind: FeedbackKind; message: string } | null;

/**
 * Picks today's puzzle index deterministically from the date-seeded RNG.
 * Same dateKey (and same puzzle count) always yields the same index.
 */
export function pickPuzzleIndex(dateKey: string, puzzleCount: number): number {
  if (puzzleCount <= 0) return 0;
  const rng = makeSeededRng(getDailySeed(dateKey, SPELLING_BEE_SLUG));
  return Math.floor(rng() * puzzleCount);
}

/** Classic Spelling Bee scoring: 4-letter words = 1 point, longer words = 1 point per letter, +7 for a pangram. */
export function computeWordScore(word: string, pangrams: ReadonlySet<string> | string[]): number {
  const pangramSet = pangrams instanceof Set ? pangrams : new Set(pangrams);
  const base = word.length <= 4 ? 1 : word.length;
  const bonus = pangramSet.has(word) ? 7 : 0;
  return base + bonus;
}

/** Sum of every valid word's score in the puzzle — the maximum score a player could reach. */
export function computeMaxScore(puzzle: SpellingBeePuzzle): number {
  const pangramSet = new Set(puzzle.pangrams);
  return puzzle.validWords.reduce((sum, word) => sum + computeWordScore(word, pangramSet), 0);
}

export function getWinThreshold(puzzle: SpellingBeePuzzle): number {
  return computeMaxScore(puzzle) * WIN_SCORE_FRACTION;
}

type ValidationResult = { ok: boolean; message: string };

export function validateWord(
  word: string,
  puzzle: SpellingBeePuzzle,
  foundWords: string[],
): ValidationResult {
  if (word.length < 4) return { ok: false, message: "Too short — need at least 4 letters" };

  const letterSet = new Set(puzzle.letters);
  for (const ch of word) {
    if (!letterSet.has(ch)) return { ok: false, message: "Uses letters outside the hive" };
  }

  if (!word.includes(puzzle.center)) {
    return { ok: false, message: `Must include the center letter "${puzzle.center}"` };
  }

  if (foundWords.includes(word)) return { ok: false, message: "Already found that one!" };

  if (!puzzle.validWords.includes(word)) return { ok: false, message: "Not in today's word list" };

  return { ok: true, message: "" };
}

function getProgressKey(dateKey: string): string {
  return `dgh:${SPELLING_BEE_SLUG}:${dateKey}`;
}

function loadProgress(dateKey: string): SavedProgress | null {
  if (typeof window === "undefined") return null;
  const raw = lsGet(getProgressKey(dateKey));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SavedProgress>;
    if (
      !Array.isArray(parsed.foundWords) ||
      typeof parsed.score !== "number" ||
      typeof parsed.completed !== "boolean"
    ) {
      return null;
    }
    return { foundWords: parsed.foundWords, score: parsed.score, completed: parsed.completed };
  } catch {
    return null;
  }
}

function saveProgress(dateKey: string, progress: SavedProgress): void {
  if (typeof window === "undefined") return;
  lsSet(getProgressKey(dateKey), JSON.stringify(progress));
}

export function SpellingBeeGame({ initialDateKey }: { initialDateKey: string }) {
  const [dateKey, setDateKey] = useState("");
  const [puzzle, setPuzzle] = useState<SpellingBeePuzzle | null>(null);
  const [currentWord, setCurrentWord] = useState("");
  const [foundWords, setFoundWords] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [ready, setReady] = useState(false);
  const [replayKey, setReplayKey] = useState<string | null>(null);

  const started = useRef(false);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const today = getUtcDateKey();
    const index = pickPuzzleIndex(today, PUZZLES.length);
    const todaysPuzzle = PUZZLES[index] ?? PUZZLES[0] ?? null;
    const saved = loadProgress(today);

    setDateKey(today);
    setPuzzle(todaysPuzzle);

    if (saved) {
      setFoundWords(saved.foundWords);
      setScore(saved.score);
      setCompleted(saved.completed);
      if (saved.foundWords.length > 0 || saved.completed) started.current = true;
    }

    setReady(true);

    return () => {
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    };
  }, []);

  const showFeedback = (kind: FeedbackKind, message: string) => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    setFeedback({ kind, message });
    feedbackTimer.current = setTimeout(() => setFeedback(null), 1800);
  };

  const markStarted = () => {
    if (started.current || !dateKey) return;
    started.current = true;
    trackEvent({ name: "game_start", slug: SPELLING_BEE_SLUG, dateKey });
  };

  const appendLetter = (letter: string) => {
    if (completed || !ready) return;
    markStarted();
    setCurrentWord((prev) => prev + letter);
  };

  const deleteLetter = () => {
    if (completed) return;
    setCurrentWord((prev) => prev.slice(0, -1));
  };

  const submitWord = () => {
    if (completed || !puzzle || !dateKey) return;
    const word = currentWord.toUpperCase();
    if (word.length === 0) return;

    markStarted();

    const result = validateWord(word, puzzle, foundWords);
    if (!result.ok) {
      showFeedback("error", result.message);
      setCurrentWord("");
      return;
    }

    const isPangram = puzzle.pangrams.includes(word);
    const wordScore = computeWordScore(word, puzzle.pangrams);
    const newFoundWords = [...foundWords, word];
    const newScore = score + wordScore;

    setFoundWords(newFoundWords);
    setScore(newScore);
    setCurrentWord("");
    showFeedback(isPangram ? "pangram" : "success", isPangram ? `Pangram! +${wordScore}` : `+${wordScore}`);
    if (!replayKey) {
      saveProgress(dateKey, { foundWords: newFoundWords, score: newScore, completed: false });
    }
  };

  const finishForToday = () => {
    if (completed || !puzzle || !dateKey) return;
    const threshold = getWinThreshold(puzzle);
    const result = score >= threshold ? "win" : "lose";

    if (!replayKey) {
      completeGame(SPELLING_BEE_SLUG, result, dateKey);
      trackEvent(createGameCompleteEvent(SPELLING_BEE_SLUG, dateKey, result));
      saveProgress(dateKey, { foundWords, score, completed: true });
      void submitLeaderboardScore(SPELLING_BEE_SLUG, dateKey, score);
    }
    setCompleted(true);
  };

  // "Play Again": a fresh, randomly-picked puzzle held in memory only —
  // today's real result in localStorage is never touched.
  const handlePlayAgain = () => {
    const newKey = makeReplayKey();
    const index = pickPuzzleIndex(newKey, PUZZLES.length);
    const nextPuzzle = PUZZLES[index] ?? PUZZLES[0] ?? null;
    if (!nextPuzzle) return;

    setReplayKey(newKey);
    setPuzzle(nextPuzzle);
    setCurrentWord("");
    setFoundWords([]);
    setScore(0);
    setCompleted(false);
    setFeedback(null);
    started.current = false;
  };

  useEffect(() => {
    if (!ready || completed || !puzzle) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === "Enter") {
        event.preventDefault();
        submitWord();
        return;
      }
      if (event.key === "Backspace") {
        event.preventDefault();
        deleteLetter();
        return;
      }
      if (/^[a-zA-Z]$/.test(event.key)) {
        const upper = event.key.toUpperCase();
        if (puzzle.letters.includes(upper)) {
          event.preventDefault();
          appendLetter(upper);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, completed, puzzle, currentWord, foundWords, score, dateKey]);

  if (!ready || !puzzle) {
    return (
      <section aria-label="Daily Spelling Bee" className="flex items-center justify-center py-10">
        <p className="text-sm text-subtle-foreground">Loading…</p>
      </section>
    );
  }

  const maxScore = computeMaxScore(puzzle);
  const threshold = getWinThreshold(puzzle);
  const outerLetters = puzzle.letters.filter((l) => l !== puzzle.center);
  const [l1, l2, l3, l4, l5, l6] = outerLetters;
  const isWin = score >= threshold;

  if (completed) {
    return (
      <section aria-label="Daily Spelling Bee — Results" className="flex flex-col items-center gap-4 py-2 text-center">
        <header className="flex flex-col items-center gap-1">
          <h2 className="font-display text-xl font-bold text-foreground">Daily Spelling Bee</h2>
          <time dateTime={dateKey || initialDateKey} className="text-xs text-subtle-foreground">
            {dateKey || initialDateKey} (UTC)
          </time>
        </header>

        <div className="flex flex-col items-center gap-1" aria-label={`Final score: ${score} points`}>
          <span className="font-display text-5xl font-bold text-foreground">{score}</span>
          <span className="text-sm text-subtle-foreground">points · {foundWords.length} words found</span>
        </div>

        <p className="text-base font-bold text-foreground">
          {isWin ? "Great job — you made today's threshold!" : "So close — try again tomorrow!"}
        </p>

        <div className="w-full max-w-sm rounded-lg border border-border bg-subtle p-3 text-left text-sm">
          <p className="mb-2 text-xs uppercase tracking-wide text-subtle-foreground">
            Words found ({foundWords.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {foundWords.map((w) => (
              <span
                key={w}
                className={`rounded-md px-2 py-1 text-xs font-bold ${
                  puzzle.pangrams.includes(w)
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-card-foreground"
                }`}
              >
                {w}
              </span>
            ))}
            {foundWords.length === 0 && <span className="text-subtle-foreground">No words found today.</span>}
          </div>
        </div>

        <button
          type="button"
          onClick={handlePlayAgain}
          className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-6 text-sm font-bold uppercase tracking-wide text-primary-foreground transition-colors hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Play Again
        </button>
        <p className="text-xs text-subtle-foreground">Come back tomorrow for a new daily hive!</p>
      </section>
    );
  }

  return (
    <section aria-label="Daily Spelling Bee" className="flex flex-col items-center gap-4 py-2">
      <header className="flex w-full flex-col items-center gap-1">
        <h2 className="font-display text-xl font-bold text-foreground">Daily Spelling Bee</h2>
        <time dateTime={dateKey || initialDateKey} className="text-xs text-subtle-foreground">
          {dateKey || initialDateKey} (UTC)
        </time>
      </header>

      <div
        className="flex items-baseline gap-2 rounded-md bg-subtle px-3 py-1.5"
        aria-label={`Score: ${score} of ${maxScore} possible, win at ${Math.ceil(threshold)}`}
      >
        <span className="font-display text-2xl font-bold text-foreground">{score}</span>
        <span className="text-xs text-subtle-foreground">pts · win at {Math.ceil(threshold)}</span>
      </div>

      {/* Word input display */}
      <div
        className="flex h-10 w-full max-w-xs items-center justify-center rounded-md border border-border bg-subtle px-3"
        aria-live="polite"
      >
        <span className="font-display text-lg font-bold tracking-widest text-foreground">
          {currentWord.split("").map((ch, i) => (
            <span key={i} className={ch === puzzle.center ? "text-primary" : ""}>
              {ch}
            </span>
          ))}
          {currentWord.length === 0 && <span className="text-subtle-foreground">Type or tap letters…</span>}
        </span>
      </div>

      {feedback && (
        <p
          className={`text-sm font-bold ${
            feedback.kind === "error"
              ? "text-red-400"
              : feedback.kind === "pangram"
                ? "text-primary"
                : "text-foreground"
          }`}
          role="status"
        >
          {feedback.message}
        </p>
      )}

      {/* Honeycomb letter layout: center + 6 outer letters */}
      <div className="flex flex-col items-center gap-2" role="group" aria-label="Letter hive">
        <div className="flex translate-x-8 gap-2">
          <HexButton letter={l1} onClick={appendLetter} />
          <HexButton letter={l2} onClick={appendLetter} />
        </div>
        <div className="flex gap-2">
          <HexButton letter={l6} onClick={appendLetter} />
          <HexButton letter={puzzle.center} onClick={appendLetter} isCenter />
          <HexButton letter={l3} onClick={appendLetter} />
        </div>
        <div className="flex translate-x-8 gap-2">
          <HexButton letter={l5} onClick={appendLetter} />
          <HexButton letter={l4} onClick={appendLetter} />
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={deleteLetter}
          className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-transparent px-4 text-sm font-bold uppercase tracking-wide text-foreground transition-colors hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Delete
        </button>
        <button
          type="button"
          onClick={submitWord}
          className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-bold uppercase tracking-wide text-primary-foreground transition-colors hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Enter
        </button>
      </div>

      <div className="w-full max-w-sm rounded-lg border border-border bg-subtle p-3 text-left text-sm">
        <p className="mb-2 text-xs uppercase tracking-wide text-subtle-foreground">
          Words found ({foundWords.length})
        </p>
        <div className="flex flex-wrap gap-1.5">
          {foundWords.map((w) => (
            <span
              key={w}
              className={`rounded-md px-2 py-1 text-xs font-bold ${
                puzzle.pangrams.includes(w) ? "bg-primary text-primary-foreground" : "bg-card text-card-foreground"
              }`}
            >
              {w}
            </span>
          ))}
          {foundWords.length === 0 && (
            <span className="text-subtle-foreground">No words yet — start typing!</span>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={finishForToday}
        className="inline-flex h-11 w-full max-w-sm items-center justify-center rounded-lg border border-border bg-transparent text-sm font-bold uppercase tracking-wide text-foreground transition-colors hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {replayKey ? "Finish round" : "Finish for today"}
      </button>
    </section>
  );
}

function HexButton({
  letter,
  onClick,
  isCenter = false,
}: {
  letter: string;
  onClick: (letter: string) => void;
  isCenter?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(letter)}
      aria-label={isCenter ? `Center letter ${letter} (required)` : `Letter ${letter}`}
      className={`flex h-14 w-14 items-center justify-center rounded-lg text-xl font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
        isCenter
          ? "bg-primary text-primary-foreground ring-2 ring-ring"
          : "bg-subtle text-foreground hover:bg-card"
      }`}
    >
      {letter}
    </button>
  );
}
