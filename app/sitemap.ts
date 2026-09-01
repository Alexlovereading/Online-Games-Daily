import type { MetadataRoute } from "next";
import { getCategories, getLiveGames } from "@/lib/games";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-static";

const staticPages: Array<{ path: string }> = [
  { path: "/about" },
  { path: "/privacy" },
  { path: "/licenses" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  // This is a static export (no server), so `lastModified` is frozen at build
  // time — it reflects the last deploy, not the daily puzzle refresh itself.
  // `changeFrequency`/`priority` are intentionally omitted: Google ignores both.
  const buildDate = new Date();

  const homepage: MetadataRoute.Sitemap[number] = {
    url: siteUrl,
    lastModified: buildDate,
  };

  const gamePages: MetadataRoute.Sitemap = getLiveGames().map((game) => ({
    url: `${siteUrl}${game.path}`,
    lastModified: buildDate,
  }));

  const categoryPages: MetadataRoute.Sitemap = getCategories().map((cat) => ({
    url: `${siteUrl}/category/${cat}`,
    lastModified: buildDate,
  }));

  const infoPages: MetadataRoute.Sitemap = staticPages.map(({ path }) => ({
    url: `${siteUrl}${path}`,
    lastModified: buildDate,
  }));

  return [homepage, ...gamePages, ...categoryPages, ...infoPages];
}
