/**
 * Adapted from uday-nc/connection-clone-nextjs, MIT © 2025 Uday N. Chakraborty.
 * Commit: 90c0ec73c9efb6025cd623d19b547466d96e54ad
 * Changes: added PuzzleData / date field; renamed types to match project conventions.
 */

export type CategoryColor = "yellow" | "green" | "blue" | "purple";

export type Category = {
  name: string;
  color: CategoryColor;
  words: string[];
};

export type PuzzleData = {
  date: string;
  categories: Category[];
};

export type GamePhase = "playing" | "won" | "lost";
