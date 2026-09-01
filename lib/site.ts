export const siteName = "Online Games Daily";
export const siteDescription =
  "A small, considered collection of daily word, number, and memory puzzles.";
export const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://onlinegamesdaily.com";

export function ogImagePath(slug?: string): string {
  return `/og/${slug ?? "home"}.png`;
}

export function ogImageUrl(slug?: string): string {
  return `${siteUrl}/og/${slug ?? "home"}.png`;
}
