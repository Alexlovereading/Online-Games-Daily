import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GameSwitcher } from "@/components/GameSwitcher";
import { Ads } from "@/components/Ads";
import { PageAdRails } from "@/components/PageAdRails";
import { getUtcDateKey } from "@/lib/daily";
import {
  getCategories,
  getGamesByCategory,
  CATEGORY_LABELS,
  type GameCategory,
} from "@/lib/games";
import { ogImagePath, siteUrl } from "@/lib/site";

export const dynamicParams = false;

// Real, distinguishing copy per category — avoids the "N free {label}, one
// puzzle a day" line repeating near-verbatim across all five category pages.
const CATEGORY_META_DESCRIPTIONS: Record<GameCategory, string> = {
  number:
    "Free daily number puzzles: 2048, Cupcake 2048, a 3-difficulty Sudoku, and Minesweeper. One new seeded board per game every day at midnight UTC.",
  word: "Free daily word games: a Wordle-style guesser, Connections-style Word Groups, Waffle, Word Search, and Spelling Bee. New puzzles every midnight UTC.",
  trivia: "Free daily capital-cities quiz — 8 questions drawn from 60 countries worldwide, the same quiz for everyone each day, reset at midnight UTC.",
  memory:
    "Free daily brain games: a 5-round reaction-time test and a 16-card memory match, reshuffled fresh every day at midnight UTC.",
  card: "Free daily Snake and Connect Four (vs. a seeded AI opponent) — the same daily challenge for every player, reset at midnight UTC.",
};

const CATEGORY_INTROS: Record<GameCategory, string> = {
  number:
    "Four daily number puzzles: classic 2048's slide-and-merge mechanic (plus its Cupcake-themed spin-off) — where every player's board starts from the same two seeded tiles, then diverges move by move — alongside a proper 9x9 Sudoku with three real difficulty tiers and a from-scratch Minesweeper board, both fully identical for every player all the way through. Every puzzle refreshes at midnight UTC.",
  word: "Five word puzzles built around formats you already know how to play: a Wordle-style five-letter guesser, a Connections-style word-grouping game, a tile-swap puzzle (Waffle), a themed word search, and a pangram-hunting Spelling Bee. Same seeded-by-date approach as the rest of the site — one puzzle, shared by everyone, resetting at midnight UTC.",
  trivia:
    "One daily trivia game so far: an eight-question capital-cities quiz drawn from a 60-country pool spanning every region, with the same eight countries and answer choices for every player each day.",
  memory:
    "Two quick daily brain-speed checks: a five-round reaction-time test scored in milliseconds, and a 16-card memory-matching board reshuffled fresh each day. Both are built to finish in a couple of minutes, seeded the same way for every player on a given day.",
  card: "Two arcade-style daily challenges: classic Snake with a shared daily food sequence, and Connect Four against a seeded AI opponent that plays the same strategy for everyone on a given day.",
};

export function generateStaticParams() {
  return getCategories().map((category) => ({ category }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  const cats = getCategories();
  if (!cats.includes(category as GameCategory)) return {};

  const label = CATEGORY_LABELS[category as GameCategory];
  const title = `${label} — Free Daily Puzzle Games`;
  const description = CATEGORY_META_DESCRIPTIONS[category as GameCategory];

  return {
    title,
    description,
    alternates: { canonical: `/category/${category}` },
    openGraph: {
      title,
      description,
      images: [{ url: ogImagePath(), width: 1200, height: 630, alt: label }],
    },
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const cats = getCategories();
  if (!cats.includes(category as GameCategory)) notFound();

  const cat = category as GameCategory;
  const games = getGamesByCategory(cat);
  const label = CATEGORY_LABELS[cat];
  const icon = games[0]?.icon;

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      {
        "@type": "ListItem",
        position: 2,
        name: label,
        item: `${siteUrl}/category/${category}`,
      },
    ],
  };

  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${label} — Online Games Daily`,
    url: `${siteUrl}/category/${category}`,
    description: CATEGORY_META_DESCRIPTIONS[cat],
    hasPart: games.map((game) => ({
      "@type": "SoftwareApplication",
      name: game.title,
      url: `${siteUrl}${game.path}`,
      image: `${siteUrl}/og/${game.slug}.png`,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    })),
  };

  const safeJson = (obj: unknown) => JSON.stringify(obj).replace(/</g, "\\u003c");

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJson(breadcrumbSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJson(collectionSchema) }} />
      <main>
        <section
          className="category-hero site-shell pt-10 pb-8 border-b border-border"
          style={{ "--cat-accent": `var(--cat-${cat}, var(--accent))` } as CSSProperties}
        >
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-subtle-foreground">
            <Link href="/" className="text-link transition-colors hover:text-foreground">
              Home
            </Link>
            <span aria-hidden="true" className="text-subtle-foreground/50">/</span>
            <span className="text-foreground">{label}</span>
          </nav>

          <div className="mt-5 flex items-center gap-4 sm:gap-5">
            {icon && (
              <span
                className="flex h-14 w-14 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-full text-2xl sm:text-3xl"
                style={{ backgroundColor: "var(--cat-accent)" }}
                aria-hidden="true"
              >
                {icon}
              </span>
            )}
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--cat-accent)" }}>
                Game category
              </p>
              <h1 className="font-display text-4xl sm:text-6xl font-bold text-foreground leading-[0.95]">{label}</h1>
            </div>
          </div>

          <p className="mt-5 max-w-2xl text-lg text-subtle-foreground">{CATEGORY_INTROS[cat]}</p>
        </section>

        <section className="mt-10">
          <PageAdRails>
            <GameSwitcher games={games} defaultSlug={games[0]?.slug} initialDateKey={getUtcDateKey()} />
          </PageAdRails>
        </section>

        <section className="site-shell mt-16 pb-16">
          <Ads variant="bottom" />
        </section>
      </main>
    </>
  );
}
