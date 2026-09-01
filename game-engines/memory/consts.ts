// Adapted from emanuelecaurio/react-card-memory-game (MIT)
// commit f08a45a55dd0665639a986d25112f8b57d26e85e
// Original: src/consts.tsx — availableCardStatuses + utf8Icons pool
// Changed: symbol pool replaced with 20 diverse Unicode symbols

export const cardStatuses = {
  clicked: "clicked",
  discovered: "discovered",
  hole: "hole",
} as const;

export type CardStatus = (typeof cardStatuses)[keyof typeof cardStatuses];

// 20 symbols — 8 picked daily via seeded RNG to form 8 pairs (16 cards total)
export const SYMBOL_POOL: string[] = [
  "🐶","🐱","🐸","🦋","🦊","🦁","🐢","🦄",
  "🐙","🦈","🐝","🌸","🍀","🔥","⭐","💎",
  "🎯","🌙","🎸","🐬",
];

export const PAIRS_COUNT = 8;
export const GRID_COLS = 4;
