import dynamic from "next/dynamic";
import type { ComponentType } from "react";

export type EngineProps = { initialDateKey: string };

// To add a new game: register it here and add an entry to config/games.json.
// No other file needs to change.
const ENGINE_REGISTRY: Record<string, ComponentType<EngineProps>> = {
  word: dynamic(() => import("@/game-engines/word/DailyWordGame").then((m) => m.DailyWordGame)),
  sudoku: dynamic(() => import("@/game-engines/sudoku/DailySudokuGame").then((m) => m.DailySudokuGame)),
  "game-2048": dynamic(() => import("@/game-engines/game-2048/Daily2048Game").then((m) => m.Daily2048Game)),
  "cupcake-2048": dynamic(() => import("@/game-engines/cupcake-2048/Cupcake2048Game").then((m) => m.Cupcake2048Game)),
  "word-groups": dynamic(() => import("@/game-engines/word-groups/WordGroupsGame").then((m) => m.WordGroupsGame)),
  memory: dynamic(() => import("@/game-engines/memory/MemoryGame").then((m) => m.MemoryGame)),
  "reaction-test": dynamic(() => import("@/game-engines/reaction-test/ReactionTestGame").then((m) => m.ReactionTestGame)),
  "capital-quiz": dynamic(() => import("@/game-engines/trivia/CapitalQuizGame").then((m) => m.CapitalQuizGame)),
  minesweeper: dynamic(() => import("@/game-engines/minesweeper/MinesweeperGame").then((m) => m.MinesweeperGame)),
  "word-search": dynamic(() => import("@/game-engines/word-search/WordSearchGame").then((m) => m.WordSearchGame)),
  "spelling-bee": dynamic(() => import("@/game-engines/spelling-bee/SpellingBeeGame").then((m) => m.SpellingBeeGame)),
  waffle: dynamic(() => import("@/game-engines/waffle/WaffleGame").then((m) => m.WaffleGame)),
  "snake-game": dynamic(() => import("@/game-engines/snake/SnakeGame").then((m) => m.SnakeGame)),
  "connect-four": dynamic(() => import("@/game-engines/connect-four/ConnectFourGame").then((m) => m.ConnectFourGame)),
};

export function getEngineComponent(engine: string): ComponentType<EngineProps> | null {
  return ENGINE_REGISTRY[engine] ?? null;
}
