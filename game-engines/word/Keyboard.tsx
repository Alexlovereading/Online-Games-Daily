/**
 * Adapted from lynn/hello src/Keyboard.tsx.
 * Source: https://github.com/lynn/hello/blob/835db051e78d0dba4e38bc4b19ae5560b8efbbc3/src/Keyboard.tsx
 * Commit: 835db051e78d0dba4e38bc4b19ae5560b8efbbc3
 * Copyright (c) 2022 Lynn. MIT License; see /NOTICE and /licenses.
 * Changes: accessible focusable keys, project labels, disabled completed state.
 */
import { Clue, clueClass, clueWord } from "./clue";

interface KeyboardProps {
  letterInfo: Map<string, Clue>;
  onKey: (key: string) => void;
  disabled?: boolean;
}

export const KEYBOARD_ROWS = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["Backspace", "z", "x", "c", "v", "b", "n", "m", "Enter"],
] as const;

export function Keyboard(props: KeyboardProps) {
  return (
    <div className="Game-keyboard" aria-label="On-screen keyboard">
      {KEYBOARD_ROWS.map((row, i) => (
        <div key={i} className="Game-keyboard-row">
          {row.map((label, j) => {
            let className = "Game-keyboard-button";
            const value = props.letterInfo.get(label.toUpperCase());
            if (value !== undefined) className += ` ${clueClass(value)}`;
            if (label.length > 1) className += " Game-keyboard-button-wide";
            const visibleLabel = label === "Backspace" ? "⌫" : label === "Enter" ? "Enter" : label.toUpperCase();
            const clueLabel = value === undefined ? "" : `, ${clueWord(value)}`;
            return (
              <button
                type="button"
                key={j}
                className={className}
                disabled={props.disabled}
                aria-label={`${label.length === 1 ? `Letter ${label}` : label}${clueLabel}`}
                onClick={() => props.onKey(label)}
              >
                {visibleLabel}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
