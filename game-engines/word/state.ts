/**
 * Submission and completion helpers extracted while adapting lynn/hello src/Game.tsx.
 * Source: https://github.com/lynn/hello/blob/835db051e78d0dba4e38bc4b19ae5560b8efbbc3/src/Game.tsx
 * Commit: 835db051e78d0dba4e38bc4b19ae5560b8efbbc3
 * Copyright (c) 2022 Lynn. MIT License; see /NOTICE and /licenses.
 */
import { ALLOWED_GUESS_SET } from "../../data/words/allowed-guesses";
import { WORD_ANSWERS } from "../../data/words/answers";
import { getDailySeed } from "../../lib/daily";

export const WORD_GAME_SLUG = "daily-word-game";
export const WORD_LENGTH = 5;
export const MAX_GUESSES = 6;
export const WORD_PROGRESS_KEY = `dgh:progress:${WORD_GAME_SLUG}`;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

export type PersistedWordGame = {
  dateKey: string;
  guesses: string[];
  currentGuess: string;
};

export type Submission =
  | { kind: "invalid"; message: string; progress: PersistedWordGame }
  | { kind: "accepted" | "won" | "lost"; message: string; progress: PersistedWordGame };

export function selectDailyAnswer(dateKey: string): string {
  const utcDayNumber = Math.floor(Date.parse(`${dateKey}T00:00:00.000Z`) / DAY_IN_MS);
  const firstHalfLength = Math.ceil(WORD_ANSWERS.length / 2);
  const bucketStart = utcDayNumber % 2 === 0 ? 0 : firstHalfLength;
  const bucketLength = utcDayNumber % 2 === 0
    ? firstHalfLength
    : WORD_ANSWERS.length - firstHalfLength;
  const index = bucketStart + (getDailySeed(dateKey, WORD_GAME_SLUG) % bucketLength);
  return WORD_ANSWERS[index];
}

export function createProgress(dateKey: string): PersistedWordGame {
  return { dateKey, guesses: [], currentGuess: "" };
}

export function editCurrentGuess(progress: PersistedWordGame, key: string): PersistedWordGame {
  if (/^[a-z]$/i.test(key)) {
    return { ...progress, currentGuess: (progress.currentGuess + key.toLowerCase()).slice(0, WORD_LENGTH) };
  }
  if (key === "Backspace") {
    return { ...progress, currentGuess: progress.currentGuess.slice(0, -1) };
  }
  return progress;
}

export function shouldIgnorePhysicalKey(targetTagName: string | undefined, key: string): boolean {
  if (targetTagName === "INPUT" || targetTagName === "TEXTAREA") return true;
  return targetTagName === "BUTTON" && (key === "Enter" || key === " ");
}

export function getGameState(progress: PersistedWordGame, answer: string): "playing" | "won" | "lost" {
  if (progress.guesses.includes(answer)) return "won";
  if (progress.guesses.length >= MAX_GUESSES) return "lost";
  return "playing";
}

export function submitCurrentGuess(progress: PersistedWordGame, answer: string): Submission {
  const guess = progress.currentGuess.toLowerCase();
  if (guess.length !== WORD_LENGTH) {
    return { kind: "invalid", message: "Enter five letters first.", progress };
  }
  if (!ALLOWED_GUESS_SET.has(guess)) {
    return { kind: "invalid", message: "That word is not in this puzzle's list.", progress };
  }

  const next = { ...progress, guesses: [...progress.guesses, guess], currentGuess: "" };
  if (guess === answer) {
    return { kind: "won", message: `Solved in ${next.guesses.length} of ${MAX_GUESSES}.`, progress: next };
  }
  if (next.guesses.length === MAX_GUESSES) {
    return { kind: "lost", message: `Today's answer was ${answer.toUpperCase()}.`, progress: next };
  }
  return { kind: "accepted", message: `${MAX_GUESSES - next.guesses.length} guesses left.`, progress: next };
}

export function restoreProgress(raw: string | null, dateKey: string): PersistedWordGame {
  if (!raw) return createProgress(dateKey);
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedWordGame>;
    const validGuesses =
      Array.isArray(parsed.guesses) &&
      parsed.guesses.length <= MAX_GUESSES &&
      parsed.guesses.every((word) => typeof word === "string" && /^[a-z]{5}$/.test(word));
    const validCurrent = typeof parsed.currentGuess === "string" && /^[a-z]{0,5}$/.test(parsed.currentGuess);
    if (parsed.dateKey !== dateKey || !validGuesses || !validCurrent) return createProgress(dateKey);
    return { dateKey, guesses: parsed.guesses as string[], currentGuess: parsed.currentGuess as string };
  } catch {
    return createProgress(dateKey);
  }
}
