"use client";

/**
 * Generic multiple-choice "daily trivia" engine.
 *
 * Extracted from game-engines/flag/FlagQuizGame.tsx (the project's original
 * multiple-choice daily-game interaction shell) and parameterized so any
 * dataset can be dropped in without re-deriving the state machine, the
 * feedback-delay/debounce timer logic, or the localStorage/stats wiring.
 *
 * The interaction pattern (unchanged from the flag quiz):
 *  - buildQuestions(dateKey): getDailySeed(dateKey, slug) -> makeSeededRng ->
 *    shuffleWithRng(dataset, rng) picks the first `questionsPerGame` items;
 *    each question's correct answer + caller-supplied distractors are
 *    shuffled together into 4 choices.
 *  - phase: "playing" | "answered" | "complete" state machine.
 *  - useRef-based advanceTimer/pending debounce: clicking a choice schedules
 *    a setTimeout(feedbackDelayMs) auto-advance; clicking "Next" fires the
 *    same advance immediately. The setTimeout callback only runs its advance
 *    if `pending.current` still refers to the exact same payload object,
 *    which prevents a stale timer from double-advancing after a manual
 *    "Next" click already did.
 *  - score >= winThreshold is a win; completeGame()/trackEvent() persist the
 *    result; progress is cached under `dgh:${slug}:${dateKey}`.
 */

import { useEffect, useRef, useState } from "react";
import { createGameCompleteEvent, trackEvent } from "../../lib/analytics";
import { getDailySeed, getUtcDateKey, makeReplayKey, makeSeededRng } from "../../lib/daily";
import { submitLeaderboardScore } from "../../lib/leaderboard-client";
import { completeGame } from "../../lib/stats";
import { lsGet, lsSet } from "../../lib/storage";

const DEFAULT_QUESTIONS_PER_GAME = 8;
const DEFAULT_WIN_THRESHOLD = 6;
const DEFAULT_FEEDBACK_DELAY_MS = 1500;

export type Choice = { id: string; label: string };

export type TriviaEngineProps<T> = {
  slug: string;
  title: string;
  initialDateKey: string;
  dataset: T[];
  questionsPerGame?: number;
  winThreshold?: number;
  feedbackDelayMs?: number;
  getPrompt: (item: T) => string;
  getCorrectAnswer: (item: T) => Choice;
  getDistractors: (item: T, pool: T[], rng: () => number) => Choice[];
};

type Question<T> = { item: T; correct: Choice; choices: Choice[] };
type AnswerRecord = { id: string; label: string; correct: boolean };

type SavedProgress = {
  score: number;
  completed: boolean;
  answers: AnswerRecord[];
};

type PendingAdvance = {
  nextIdx: number;
  newScore: number;
  newAnswers: AnswerRecord[];
};

export function shuffleWithRng<T>(arr: T[], rng: () => number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildQuestions<T>(
  dateKey: string,
  slug: string,
  dataset: T[],
  questionsPerGame: number,
  getCorrectAnswer: (item: T) => Choice,
  getDistractors: (item: T, pool: T[], rng: () => number) => Choice[],
): Question<T>[] {
  const seed = getDailySeed(dateKey, slug);
  const rng = makeSeededRng(seed);

  const shuffled = shuffleWithRng(dataset, rng);
  const picked = shuffled.slice(0, questionsPerGame);

  return picked.map((item) => {
    const correct = getCorrectAnswer(item);
    const distractors = getDistractors(item, dataset, rng);
    const choices = shuffleWithRng([correct, ...distractors], rng);
    return { item, correct, choices };
  });
}

function getProgressKey(slug: string, dateKey: string): string {
  return `dgh:${slug}:${dateKey}`;
}

function loadProgress(slug: string, dateKey: string): SavedProgress | null {
  if (typeof window === "undefined") return null;
  const raw = lsGet(getProgressKey(slug, dateKey));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SavedProgress;
  } catch {
    return null;
  }
}

function saveProgress(slug: string, dateKey: string, progress: SavedProgress): void {
  if (typeof window === "undefined") return;
  lsSet(getProgressKey(slug, dateKey), JSON.stringify(progress));
}

function applyResult(
  slug: string,
  dateKey: string,
  newScore: number,
  newAnswers: AnswerRecord[],
  winThreshold: number,
): void {
  const result = newScore >= winThreshold ? "win" : "lose";
  completeGame(slug, result, dateKey);
  trackEvent(createGameCompleteEvent(slug, dateKey, result));
  saveProgress(slug, dateKey, { score: newScore, completed: true, answers: newAnswers });
  void submitLeaderboardScore(slug, dateKey, newScore);
}

export function TriviaEngine<T>(props: TriviaEngineProps<T>) {
  const {
    slug,
    title,
    initialDateKey,
    dataset,
    questionsPerGame = DEFAULT_QUESTIONS_PER_GAME,
    winThreshold = DEFAULT_WIN_THRESHOLD,
    feedbackDelayMs = DEFAULT_FEEDBACK_DELAY_MS,
    getPrompt,
    getCorrectAnswer,
    getDistractors,
  } = props;

  const [dateKey, setDateKey] = useState("");
  const [questions, setQuestions] = useState<Question<T>[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [phase, setPhase] = useState<"playing" | "answered" | "complete">("playing");
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [ready, setReady] = useState(false);
  const [replayKey, setReplayKey] = useState<string | null>(null);

  const started = useRef(false);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<PendingAdvance | null>(null);

  useEffect(() => {
    const today = getUtcDateKey();
    const qs = buildQuestions(
      today,
      slug,
      dataset,
      questionsPerGame,
      getCorrectAnswer,
      getDistractors,
    );
    const saved = loadProgress(slug, today);

    setDateKey(today);
    setQuestions(qs);

    if (saved?.completed) {
      setScore(saved.score);
      setAnswers(saved.answers);
      setCurrentIdx(questionsPerGame);
      setPhase("complete");
    }

    setReady(true);

    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doAdvance = (
    nextIdx: number,
    newScore: number,
    newAnswers: AnswerRecord[],
    today: string,
  ) => {
    pending.current = null;
    if (nextIdx >= questionsPerGame) {
      if (!replayKey) applyResult(slug, today, newScore, newAnswers, winThreshold);
      setScore(newScore);
      setAnswers(newAnswers);
      setCurrentIdx(nextIdx);
      setPhase("complete");
    } else {
      if (!replayKey) saveProgress(slug, today, { score: newScore, completed: false, answers: newAnswers });
      setScore(newScore);
      setAnswers(newAnswers);
      setCurrentIdx(nextIdx);
      setSelected(null);
      setPhase("playing");
    }
  };

  // "Play Again": a fresh, randomly-picked 8-question round held in memory
  // only — today's real result in localStorage is never touched.
  const handlePlayAgain = () => {
    if (advanceTimer.current) {
      clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
    pending.current = null;

    const newKey = makeReplayKey();
    const qs = buildQuestions(newKey, slug, dataset, questionsPerGame, getCorrectAnswer, getDistractors);

    setReplayKey(newKey);
    setQuestions(qs);
    setCurrentIdx(0);
    setSelected(null);
    setScore(0);
    setAnswers([]);
    setPhase("playing");
    started.current = false;
  };

  const handleSelect = (chosenId: string) => {
    if (phase !== "playing" || selected !== null || !ready || !dateKey) return;

    if (!started.current) {
      started.current = true;
      trackEvent({ name: "game_start", slug, dateKey });
    }

    const currentQuestion = questions[currentIdx];
    const correct = chosenId === currentQuestion.correct.id;
    const newScore = score + (correct ? 1 : 0);
    const newAnswers = [
      ...answers,
      { id: currentQuestion.correct.id, label: currentQuestion.correct.label, correct },
    ];
    const nextIdx = currentIdx + 1;

    setSelected(chosenId);
    setPhase("answered");

    const advancePayload: PendingAdvance = { nextIdx, newScore, newAnswers };
    pending.current = advancePayload;

    advanceTimer.current = setTimeout(() => {
      if (pending.current === advancePayload) {
        doAdvance(nextIdx, newScore, newAnswers, dateKey);
      }
    }, feedbackDelayMs);
  };

  const handleContinue = () => {
    if (advanceTimer.current) {
      clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
    const p = pending.current;
    if (p) {
      doAdvance(p.nextIdx, p.newScore, p.newAnswers, dateKey);
    }
  };

  if (!ready) {
    return (
      <section className="fq-game" aria-label={title}>
        <p className="fq-loading">Loading…</p>
      </section>
    );
  }

  if (phase === "complete") {
    const isWin = score >= winThreshold;
    return (
      <section className="fq-game fq-result" aria-label={`${title} Results`}>
        <header className="fq-header">
          <h2>{title}</h2>
          <time dateTime={dateKey || initialDateKey}>{dateKey || initialDateKey} (UTC)</time>
        </header>

        <div
          className="fq-score-display"
          aria-label={`Score: ${score} out of ${questionsPerGame}`}
        >
          <span className="fq-score-number">{score}</span>
          <span className="fq-score-denom"> / {questionsPerGame}</span>
        </div>

        <p className="fq-result-label">
          {isWin ? "Excellent work!" : "Better luck tomorrow!"}
        </p>

        <div className="fq-answer-review" aria-label="Question review">
          {answers.map((a, i) => (
            <span
              key={i}
              className={`fq-answer-pip ${a.correct ? "correct" : "wrong"}`}
              title={a.label}
              aria-label={`Question ${i + 1} — ${a.correct ? "correct" : "incorrect"}: ${a.label}`}
            >
              {a.correct ? "✓" : "✗"}
            </span>
          ))}
        </div>

        <button className="fq-continue" onClick={handlePlayAgain}>
          Play Again
        </button>
        <p className="fq-comeback">Come back tomorrow for a new daily quiz!</p>
      </section>
    );
  }

  const question = questions[currentIdx];
  if (!question) return null;

  const fillPercent = (currentIdx / questionsPerGame) * 100;

  return (
    <section className="fq-game" aria-label={title} data-ready={ready}>
      <header className="fq-header">
        <h2>{title}</h2>
        <time dateTime={dateKey}>{dateKey} (UTC)</time>
      </header>

      <div
        className="fq-progress"
        aria-label={`Question ${currentIdx + 1} of ${questionsPerGame}`}
      >
        <span>
          Question {currentIdx + 1} / {questionsPerGame}
        </span>
        <div
          className="fq-progress-bar"
          role="progressbar"
          aria-valuenow={currentIdx}
          aria-valuemin={0}
          aria-valuemax={questionsPerGame}
        >
          <div className="fq-progress-fill" style={{ transform: `scaleX(${fillPercent / 100})` }} />
        </div>
      </div>

      <p className="fq-question-label">{getPrompt(question.item)}</p>

      <div className="fq-choices" role="group" aria-label="Answer choices">
        {question.choices.map((choice) => {
          const isSelected = selected === choice.id;
          const isCorrect = choice.id === question.correct.id;

          let className = "fq-choice";
          if (phase === "answered") {
            if (isCorrect) className += " correct";
            else if (isSelected) className += " wrong";
            className += " disabled";
          }

          return (
            <button
              key={choice.id}
              className={className}
              onClick={() => handleSelect(choice.id)}
              disabled={phase === "answered"}
              aria-pressed={isSelected}
              aria-label={
                phase === "answered"
                  ? `${choice.label}${isCorrect ? " — correct" : isSelected ? " — wrong" : ""}`
                  : choice.label
              }
            >
              {choice.label}
            </button>
          );
        })}
      </div>

      {phase === "answered" && (
        <button className="fq-continue" onClick={handleContinue}>
          {currentIdx + 1 < questionsPerGame ? "Next →" : "See Results"}
        </button>
      )}
    </section>
  );
}
