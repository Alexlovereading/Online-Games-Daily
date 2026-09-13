"use client";

import { TriviaEngine, shuffleWithRng, type Choice } from "./TriviaEngine";
import capitalsData from "../../data/trivia/capitals.json";

export const FLAG_QUIZ_SLUG = "flag-quiz";

// Reuses the capitals dataset; the `capital` field is irrelevant here.
export type FlagEntry = { code: string; country: string };

// Pure function (exported for testing): pick 3 distinct countries as wrong
// answers, excluding the current entry, deterministically shuffled by the
// supplied seeded rng.
export function getFlagDistractors(
  entry: FlagEntry,
  pool: FlagEntry[],
  rng: () => number,
): Choice[] {
  const rest = pool.filter((candidate) => candidate.code !== entry.code);
  const shuffledRest = shuffleWithRng(rest, rng);
  return shuffledRest.slice(0, 3).map((candidate) => ({ id: candidate.code, label: candidate.country }));
}

export function FlagQuizGame({ initialDateKey }: { initialDateKey: string }) {
  return (
    <TriviaEngine<FlagEntry>
      slug={FLAG_QUIZ_SLUG}
      title="Daily Flag Quiz"
      initialDateKey={initialDateKey}
      dataset={capitalsData as FlagEntry[]}
      getPrompt={() => "Which country's flag is this?"}
      // The alt text must stay generic: naming the country here would put the
      // answer straight into the DOM, spoiling it for screen-reader users and
      // anyone viewing source.
      getPromptMedia={(c) => ({ src: `/flags/${c.code.toLowerCase()}.svg`, alt: "National flag to identify" })}
      getCorrectAnswer={(c) => ({ id: c.code, label: c.country })}
      getDistractors={getFlagDistractors}
    />
  );
}
