"use client";

import { TriviaEngine, shuffleWithRng, type Choice } from "./TriviaEngine";
import capitalsData from "../../data/trivia/capitals.json";

export const CAPITAL_QUIZ_SLUG = "capital-quiz";

export type CapitalEntry = { code: string; country: string; capital: string };

// Pure function (exported for testing): pick 3 distinct-country capitals as
// wrong answers, excluding the current entry, deterministically shuffled by
// the supplied seeded rng.
export function getCapitalDistractors(
  entry: CapitalEntry,
  pool: CapitalEntry[],
  rng: () => number,
): Choice[] {
  const rest = pool.filter((candidate) => candidate.code !== entry.code);
  const shuffledRest = shuffleWithRng(rest, rng);
  return shuffledRest.slice(0, 3).map((candidate) => ({ id: candidate.code, label: candidate.capital }));
}

export function CapitalQuizGame({ initialDateKey }: { initialDateKey: string }) {
  return (
    <TriviaEngine<CapitalEntry>
      slug={CAPITAL_QUIZ_SLUG}
      title="Daily Capital Quiz"
      initialDateKey={initialDateKey}
      dataset={capitalsData as CapitalEntry[]}
      getPrompt={(c) => `Which city is the capital of ${c.country}?`}
      getCorrectAnswer={(c) => ({ id: c.code, label: c.capital })}
      getDistractors={getCapitalDistractors}
    />
  );
}
