/**
 * Adapted from uday-nc/connection-clone-nextjs, MIT © 2025 Uday N. Chakraborty.
 * Commit: 90c0ec73c9efb6025cd623d19b547466d96e54ad
 * Changes: accepts external PuzzleData + optional saved progress; added GamePhase,
 * "One away!" detection, message state, and shuffleWords action.
 */

import { useCallback, useEffect, useState } from "react";
import type { Category, GamePhase, PuzzleData } from "./types";

const MAX_MISTAKES = 4;

export type SavedProgress = {
  found: Category[];
  mistakes: number;
  phase: GamePhase;
};

function shuffleArray<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function sortedKey(words: string[]): string {
  return [...words].sort().join("|");
}

export type WordGroupsState = {
  words: string[];
  selected: string[];
  found: Category[];
  mistakes: number;
  maxMistakes: number;
  phase: GamePhase;
  message: string | null;
};

export type WordGroupsActions = {
  toggleWord: (word: string) => void;
  submitGuess: () => void;
  shuffleWords: () => void;
  clearMessage: () => void;
};

export function useWordGroups(
  puzzleData: PuzzleData | null,
  savedProgress?: SavedProgress | null,
): WordGroupsState & WordGroupsActions {
  const [words, setWords] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [found, setFound] = useState<Category[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [phase, setPhase] = useState<GamePhase>("playing");
  const [message, setMessage] = useState<string | null>(null);

  // Re-initializes whenever puzzleData changes (including a "Play Again"
  // swap to a different puzzle) or savedProgress is explicitly reset (e.g.
  // to null when starting a replay round).
  useEffect(() => {
    if (!puzzleData) return;

    const sp = savedProgress;
    const allWords = puzzleData.categories.flatMap((c) => c.words);

    if (sp) {
      const foundWords = new Set(sp.found.flatMap((c) => c.words));
      const remaining = allWords.filter((w) => !foundWords.has(w));
      setWords(sp.phase === "lost" ? [] : shuffleArray(remaining));
      setFound(sp.found);
      setMistakes(sp.mistakes);
      setPhase(sp.phase);
    } else {
      setWords(shuffleArray(allWords));
      setFound([]);
      setMistakes(0);
      setPhase("playing");
    }

    setSelected([]);
    setMessage(null);
  }, [puzzleData, savedProgress]);

  const clearMessage = useCallback(() => setMessage(null), []);

  const toggleWord = useCallback(
    (word: string) => {
      if (phase !== "playing") return;
      setSelected((prev) => {
        if (prev.includes(word)) return prev.filter((w) => w !== word);
        if (prev.length >= 4) return prev;
        return [...prev, word];
      });
    },
    [phase],
  );

  // submitGuess reads found/mistakes/selected/puzzleData from the closure.
  // These are all current-render values so no stale-closure concern.
  const submitGuess = useCallback(() => {
    if (phase !== "playing" || selected.length !== 4 || !puzzleData) return;

    const selectedKey = sortedKey(selected);
    const unfound = puzzleData.categories.filter(
      (c) => !found.some((f) => f.name === c.name),
    );
    const matchedCat = unfound.find((c) => sortedKey(c.words) === selectedKey);

    if (matchedCat) {
      const nextFound = [...found, matchedCat];
      setFound(nextFound);
      setWords((prev) => prev.filter((w) => !matchedCat.words.includes(w)));
      setSelected([]);

      if (nextFound.length === puzzleData.categories.length) {
        setPhase("won");
        // Won — no transient message; the result overlay handles it.
      } else {
        setMessage("Correct!");
        setTimeout(() => setMessage(null), 2000);
      }
      return;
    }

    // Wrong guess — check for "one away": exactly 3 of 4 selected in one category.
    const oneAway = unfound.some(
      (c) => selected.filter((w) => c.words.includes(w)).length === 3,
    );

    const nextMistakes = mistakes + 1;
    setMistakes(nextMistakes);
    setSelected([]);
    setMessage(oneAway ? "One away!" : "Not quite!");
    setTimeout(() => setMessage(null), 2000);

    if (nextMistakes >= MAX_MISTAKES) {
      setPhase("lost");
      setFound(puzzleData.categories); // reveal all groups
      setWords([]);
    }
  }, [phase, selected, puzzleData, found, mistakes]);

  const shuffleWords = useCallback(() => {
    if (phase !== "playing") return;
    setWords((prev) => shuffleArray(prev));
  }, [phase]);

  return {
    words,
    selected,
    found,
    mistakes,
    maxMistakes: MAX_MISTAKES,
    phase,
    message,
    toggleWord,
    submitGuess,
    shuffleWords,
    clearMessage,
  };
}
