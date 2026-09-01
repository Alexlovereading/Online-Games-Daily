export type AnalyticsEvent =
  | { name: "game_start"; slug: string; dateKey: string }
  | { name: "game_complete"; slug: string; dateKey: string; result: "win" | "lose" }
  | { name: "nav_click"; from: string; to: string };

export function createGameCompleteEvent(
  slug: string,
  dateKey: string,
  result: "win" | "lose",
): AnalyticsEvent {
  return { name: "game_complete", slug, dateKey, result };
}

export function trackEvent(_event: AnalyticsEvent): void {
  // Stage 1 intentionally keeps analytics provider-neutral and side-effect free.
}
