// Adapted from src/getGeneratedGrid.ts
// Original used Math.random(); replaced with seeded RNG parameter
import { PAIRS_COUNT, SYMBOL_POOL } from "./consts";
import { shuffleArray } from "./shuffleArray";

export function getGeneratedGrid(rng: () => number): string[] {
  const shuffledPool = shuffleArray([...SYMBOL_POOL], rng);
  const chosen = shuffledPool.slice(0, PAIRS_COUNT);
  const paired = chosen.flatMap((sym) => [sym, sym]);
  return shuffleArray(paired, rng);
}
