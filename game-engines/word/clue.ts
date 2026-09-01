/**
 * Adapted from lynn/hello src/clue.ts.
 * Source: https://github.com/lynn/hello/blob/835db051e78d0dba4e38bc4b19ae5560b8efbbc3/src/clue.ts
 * Commit: 835db051e78d0dba4e38bc4b19ae5560b8efbbc3
 * Copyright (c) 2022 Lynn. MIT License; see /NOTICE and /licenses.
 *
 * Changes: fixed five-letter scope; removed difficulty/violation helpers;
 * retained the original two-stage exact-then-elusive letter consumption.
 */
export enum Clue {
  Absent,
  Elsewhere,
  Correct,
}

export interface CluedLetter {
  clue?: Clue;
  letter: string;
}

export function clue(word: string, target: string): CluedLetter[] {
  const elusive: string[] = [];
  target.split("").forEach((letter, i) => {
    if (word[i] !== letter) {
      elusive.push(letter);
    }
  });
  return word.split("").map((letter, i) => {
    let j: number;
    if (target[i] === letter) {
      return { clue: Clue.Correct, letter };
    } else if ((j = elusive.indexOf(letter)) > -1) {
      // Consume the remaining target letter so a duplicate cannot be clued twice.
      elusive[j] = "";
      return { clue: Clue.Elsewhere, letter };
    } else {
      return { clue: Clue.Absent, letter };
    }
  });
}

export function clueClass(value: Clue): string {
  if (value === Clue.Absent) return "letter-absent";
  if (value === Clue.Elsewhere) return "letter-elsewhere";
  return "letter-correct";
}

export function clueWord(value: Clue): string {
  if (value === Clue.Absent) return "absent";
  if (value === Clue.Elsewhere) return "present elsewhere";
  return "correct";
}
