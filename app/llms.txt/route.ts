import { CATEGORY_LABELS, getCategories, getGamesByCategory } from "@/lib/games";
import { siteDescription, siteName, siteUrl } from "@/lib/site";

export const dynamic = "force-static";

export function GET() {
  const lines: string[] = [`# ${siteName}`, "", siteDescription, "", `> ${siteUrl}`, ""];

  for (const category of getCategories()) {
    lines.push(`## ${CATEGORY_LABELS[category]}`);
    for (const game of getGamesByCategory(category)) {
      if (game.status !== "live") continue;
      lines.push(`- [${game.title}](${siteUrl}${game.path}): ${game.description}`);
    }
    lines.push("");
  }

  lines.push(`Sitemap: ${siteUrl}/sitemap.xml`);

  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
