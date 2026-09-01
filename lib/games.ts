import gamesData from "../config/games.json";

export type GameCategory = "word" | "number" | "trivia" | "memory" | "card";

export const CATEGORY_LABELS: Record<GameCategory, string> = {
  word: "Word Games",
  number: "Math Games",
  trivia: "Trivia Games",
  memory: "Memory Games",
  card: "Card Games",
};

export type GameConfig = {
  slug: string;
  title: string;
  description: string;
  icon?: string;
  color?: string;
  path: string;
  engine: string;
  category: GameCategory;
  daily: boolean;
  featured?: boolean;
  priority: number;
  status: "live" | "soon";
  keywords: string[];
  related: string[];
  faq: { q: string; a: string }[];
  tips: string[];
  howToPlay: string[];
};

const games = [...(gamesData as GameConfig[])].sort(
  (first, second) => first.priority - second.priority,
);

export function getAllGames(): GameConfig[] {
  return [...games];
}

export function getLiveGames(): GameConfig[] {
  return games.filter((game) => game.status === "live");
}

export function getFeaturedGame(): GameConfig {
  const featured = games.filter((game) => game.featured);

  if (featured.length !== 1) {
    throw new Error("games.json must contain exactly one featured game.");
  }

  return featured[0];
}

export function getGameBySlug(slug: string): GameConfig | undefined {
  return games.find((game) => game.slug === slug);
}

export function getGamesByCategory(category: GameCategory): GameConfig[] {
  return games.filter((game) => game.category === category);
}

export function getCategories(): GameCategory[] {
  // `games` is already sorted by priority (search volume) ascending, so the
  // first time each category appears is its highest-volume game — ordering
  // categories by that first appearance ranks categories by search volume too.
  const order: GameCategory[] = [];
  for (const game of games) {
    if (!order.includes(game.category)) order.push(game.category);
  }
  return order;
}
