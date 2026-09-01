import Link from "next/link";
import type { CSSProperties } from "react";
import { GameCard } from "@/components/GameCard";
import { GameSwitcher } from "@/components/GameSwitcher";
import { Ads } from "@/components/Ads";
import { PageAdRails } from "@/components/PageAdRails";
import { getUtcDateKey } from "@/lib/daily";
import { getAllGames, getFeaturedGame, getLiveGames, getCategories, getGamesByCategory, CATEGORY_LABELS } from "@/lib/games";
import { ogImagePath, ogImageUrl, siteUrl, siteName, siteDescription } from "@/lib/site";

const OG_TITLE = "Online Games Daily — Free Daily Word & Puzzle Games";
const OG_DESC = `Play ${getLiveGames().length} free daily puzzle games — word, number, trivia, memory, and card games. One fresh puzzle per game, every day at midnight UTC.`;

export const metadata = {
  title: OG_TITLE,
  description: OG_DESC,
  alternates: { canonical: "/" },
  openGraph: {
    title: OG_TITLE,
    description: OG_DESC,
    images: [{ url: ogImagePath(), width: 1200, height: 630, alt: "Online Games Daily" }],
  },
  twitter: {
    images: [ogImagePath()],
  },
};

export default function HomePage() {
  const featured = getFeaturedGame();
  const games = getAllGames();
  const liveGames = getLiveGames();

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteName,
    url: siteUrl,
    description: siteDescription,
  };

  const orgSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteName,
    url: siteUrl,
    logo: `${siteUrl}/logo.png`,
    description:
      "Independent daily puzzle game website offering free word, math, trivia, memory, and card games refreshed every day at midnight UTC.",
    email: "contact@onlinegamesdaily.com",
  };

  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Daily Puzzle Games at Online Games Daily",
    description: `${liveGames.length} free daily puzzle games, one puzzle per game per day at midnight UTC.`,
    numberOfItems: liveGames.length,
    itemListElement: liveGames.map((game, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "SoftwareApplication",
        name: game.title,
        url: `${siteUrl}${game.path}`,
        description: game.description,
        image: ogImageUrl(game.slug),
        applicationCategory: "GameApplication",
        operatingSystem: "Web Browser",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      },
    })),
  };

  const safeJson = (obj: unknown) => JSON.stringify(obj).replace(/</g, "\\u003c");

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJson(websiteSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJson(orgSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJson(itemListSchema) }} />

      <section className="site-shell pt-10">
        <p className="eyebrow">On today&apos;s desk</p>
        <h1 className="font-display text-5xl sm:text-7xl font-bold text-foreground mt-3">Free Daily Puzzle Games</h1>
        <p className="mt-4 max-w-2xl text-lg text-subtle-foreground">{liveGames.length} free daily puzzles across word, number, trivia, memory, and card games — one fresh challenge each at midnight UTC. No account needed.</p>
      </section>

      <section className="mt-12">
        <PageAdRails>
          <GameSwitcher games={getAllGames()} defaultSlug={featured.slug} initialDateKey={getUtcDateKey()} />
        </PageAdRails>
      </section>

      <section className="site-shell mt-24">
        <p className="eyebrow">Explore</p>
        <h2 className="font-display text-3xl font-bold text-foreground mt-2">Browse by category</h2>
        <div className="mt-7 flex flex-wrap gap-3">
          {getCategories().map((cat) => {
            const icon = getGamesByCategory(cat)[0]?.icon;
            return (
              <Link
                key={cat}
                href={`/category/${cat}`}
                className="group flex items-center gap-2 rounded-full border border-border bg-card py-2 pl-2 pr-4 transition hover:-translate-y-0.5 hover:border-[var(--cat-accent)]"
                style={{ "--cat-accent": `var(--cat-${cat})` } as CSSProperties}
              >
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-full text-base"
                  style={{ backgroundColor: `var(--cat-${cat})` }}
                  aria-hidden="true"
                >
                  {icon}
                </span>
                <span className="text-sm font-bold text-foreground">{CATEGORY_LABELS[cat]}</span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="site-shell mt-24" id="game-index">
        <div className="index-heading">
          <div>
            <p className="eyebrow">The collection</p>
            <h2>All games</h2>
          </div>
          <p className="text-sm text-subtle-foreground">Every game refreshes with a brand-new puzzle at midnight UTC — no account, no download, just today&apos;s challenge.</p>
        </div>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {games.map((game, index) => <GameCard game={game} index={index} key={game.slug} />)}
        </div>
      </section>

      <section className="site-shell mt-20 pb-16">
        <Ads variant="bottom" />
      </section>

      <section className="site-shell mt-16 pb-16 border-t border-border pt-12" aria-label="About Online Games Daily">
        <h2 className="font-display text-2xl font-bold text-foreground">Why these puzzles are the same for everyone</h2>
        <p className="mt-4 max-w-2xl text-subtle-foreground">
          Every game on this site pulls its daily puzzle from the same source: the UTC calendar
          date. Turn today&apos;s date and a game&apos;s slug into a seed, and that seed drives
          everything about the puzzle — no server, no database, no login. It&apos;s why the
          Sudoku board, the five-letter word, and Snake&apos;s food sequence are identical for a
          player in Lagos and a player in Los Angeles on any given day, and why a fresh set
          replaces them at midnight UTC. Game progress itself stays local — saved in your
          browser, never sent anywhere.{" "}
          <Link href="/about" className="text-link transition-colors hover:text-foreground">
            Read more about how this site works →
          </Link>
        </p>
      </section>
    </main>
  );
}
