import { describe, expect, it } from "vitest";
import {
  getAllGames,
  getCategories,
  getFeaturedGame,
  getGameBySlug,
  getGamesByCategory,
  getLiveGames,
} from "../lib/games";

describe("game configuration", () => {
  it("has unique slugs, paths, and exactly one featured game", () => {
    const games = getAllGames();
    expect(new Set(games.map((game) => game.slug)).size).toBe(games.length);
    expect(new Set(games.map((game) => game.path)).size).toBe(games.length);
    expect(games.filter((game) => game.featured)).toHaveLength(1);
    expect(getFeaturedGame().slug).toBe("cupcake-2048");
  });

  it("all fourteen engines are live", () => {
    const live = getLiveGames();
    expect(live).toHaveLength(14);
    expect(live.every((game) => game.status === "live")).toBe(true);
    expect(getGameBySlug("daily-sudoku")?.status).toBe("live");
  });

  it("uses root-level paths that match their slugs", () => {
    for (const game of getAllGames()) {
      expect(game.path).toBe(`/${game.slug}`);
    }
  });

  it("every game has a valid category", () => {
    const validCategories = new Set(["word", "number", "trivia", "memory", "card"]);
    for (const game of getAllGames()) {
      expect(validCategories.has(game.category)).toBe(true);
    }
  });

  it("getCategories returns stable ordered list of present categories", () => {
    const cats = getCategories();
    expect(cats).toEqual(["number", "memory", "word", "card", "trivia"]);
  });

  it("getGamesByCategory returns correct games", () => {
    expect(getGamesByCategory("word").map((g) => g.slug)).toEqual([
      "spelling-bee",
      "word-search",
      "waffle",
      "daily-word-game",
      "daily-word-groups",
    ]);
    expect(getGamesByCategory("number").map((g) => g.slug)).toEqual([
      "cupcake-2048",
      "daily-sudoku",
      "2048",
      "minesweeper",
    ]);
    expect(getGamesByCategory("trivia").map((g) => g.slug)).toEqual(["capital-quiz"]);
    expect(getGamesByCategory("memory").map((g) => g.slug)).toEqual([
      "reaction-test",
      "memory-game",
    ]);
    expect(getGamesByCategory("card").map((g) => g.slug)).toEqual([
      "snake-game",
      "connect-four",
    ]);
  });

  it("every category has at least one live game", () => {
    for (const cat of getCategories()) {
      expect(getGamesByCategory(cat).length).toBeGreaterThanOrEqual(1);
    }
  });
});
