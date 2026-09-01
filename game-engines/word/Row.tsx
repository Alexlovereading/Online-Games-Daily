/**
 * Adapted from lynn/hello src/Row.tsx.
 * Source: https://github.com/lynn/hello/blob/835db051e78d0dba4e38bc4b19ae5560b8efbbc3/src/Row.tsx
 * Commit: 835db051e78d0dba4e38bc4b19ae5560b8efbbc3
 * Copyright (c) 2022 Lynn. MIT License; see /NOTICE and /licenses.
 * Changes: fixed five-column rows and project-specific accessible labels/classes.
 */
import { Clue, clueClass, type CluedLetter, clueWord } from "./clue";

export enum RowState {
  LockedIn,
  Editing,
  Pending,
}

interface RowProps {
  rowState: RowState;
  wordLength: number;
  cluedLetters: CluedLetter[];
  rowNumber: number;
}

export function Row(props: RowProps) {
  const isLockedIn = props.rowState === RowState.LockedIn;
  const isEditing = props.rowState === RowState.Editing;
  const letterDivs = props.cluedLetters
    .concat(Array(props.wordLength).fill({ clue: Clue.Absent, letter: "" }))
    .slice(0, props.wordLength)
    .map(({ clue: value, letter }, i) => {
      let letterClass = "Row-letter";
      if (isLockedIn && value !== undefined) letterClass += ` ${clueClass(value)}`;
      if (isEditing && letter) letterClass += " Row-letter-filled";
      return (
        <td
          key={i}
          className={letterClass}
          aria-label={
            isLockedIn
              ? `${letter.toUpperCase()}: ${value === undefined ? "unscored" : clueWord(value)}`
              : letter
                ? `Row ${props.rowNumber}, letter ${i + 1}: ${letter.toUpperCase()}`
                : `Row ${props.rowNumber}, letter ${i + 1}: empty`
          }
        >
          {letter}
        </td>
      );
    });
  let rowClass = "Row";
  if (isLockedIn) rowClass += " Row-locked-in";
  if (isEditing) rowClass += " Row-editing";
  return <tr className={rowClass}>{letterDivs}</tr>;
}
