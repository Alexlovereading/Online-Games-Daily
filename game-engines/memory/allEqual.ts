// Verbatim from src/AllEqual.ts (renamed camelCase)
export function allEqual<T>(arr: T[], value: T): boolean {
  return arr.every((v) => v === value);
}
