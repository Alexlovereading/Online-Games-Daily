import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GameLayout } from "@/components/GameLayout";
import { getEngineComponent } from "@/lib/engine-registry";
import { getUtcDateKey } from "@/lib/daily";
import { CATEGORY_LABELS, getAllGames, getGameBySlug } from "@/lib/games";
import { ogImagePath, ogImageUrl, siteUrl } from "@/lib/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return getAllGames().map((game) => ({ slug: game.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const game = getGameBySlug(slug);

  if (!game) return {};

  return {
    title: game.title,
    description: game.description,
    keywords: game.keywords,
    alternates: { canonical: game.path },
    openGraph: {
      title: game.title,
      description: game.description,
      url: game.path,
      images: [{ url: ogImagePath(game.slug), width: 1200, height: 630, alt: game.title }],
    },
    twitter: {
      card: "summary_large_image" as const,
      images: [ogImagePath(game.slug)],
    },
    robots: game.status === "soon" ? { index: false, follow: true } : undefined,
  };
}

export default async function GamePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const game = getGameBySlug(slug);

  if (!game) notFound();

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: game.faq.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  const appSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: game.title,
    url: `${siteUrl}${game.path}`,
    image: ogImageUrl(game.slug),
    applicationCategory: "GameApplication",
    operatingSystem: "Web Browser",
    description: game.description,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
  };

  const categoryLabel = CATEGORY_LABELS[game.category];

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      {
        "@type": "ListItem",
        position: 2,
        name: categoryLabel,
        item: `${siteUrl}/category/${game.category}`,
      },
      { "@type": "ListItem", position: 3, name: game.title, item: `${siteUrl}${game.path}` },
    ],
  };

  return (
    <>
      {game.status === "live" && (
        <>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema).replace(/</g, "\\u003c") }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(appSchema).replace(/</g, "\\u003c") }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema).replace(/</g, "\\u003c") }}
          />
        </>
      )}
      <GameLayout config={game}>
        {(() => {
          const EngineComponent = getEngineComponent(game.engine);
          return EngineComponent ? (
            <EngineComponent initialDateKey={getUtcDateKey()} />
          ) : (
            <section className="engine-placeholder" aria-labelledby="workshop-title">
              <span className="stamp">Phase 1</span>
              <div className="placeholder-symbol" aria-hidden="true">
                <span /><span /><span />
              </div>
              <p className="section-label">In the workshop</p>
              <h2 id="workshop-title">The board is being set.</h2>
              <p>This page and its daily framework are ready. The playable engine will be added in its own licensed phase.</p>
            </section>
          );
        })()}
      </GameLayout>
    </>
  );
}
