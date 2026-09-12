import Link from "next/link";
import { CATEGORY_LABELS, getGameBySlug, type GameConfig } from "@/lib/games";

export function SeoBlocks({ config }: { config: GameConfig }) {
  const relatedGames = config.related
    .map(getGameBySlug)
    .filter((game): game is GameConfig => Boolean(game));

  return (
    <section className="site-shell py-16" aria-label={`About ${config.title}`}>
      <div className="space-y-16">
        <div className="grid gap-12 sm:grid-cols-2">
          <section>
            <p className="text-xs font-bold uppercase tracking-widest text-subtle-foreground">
              Getting started
            </p>
            <h2 className="font-display text-2xl mb-4 mt-1">
              How to Play {config.title}
            </h2>
            <ol className="list-decimal list-inside space-y-2 marker:text-primary marker:font-bold">
              {config.howToPlay.map((step) => (
                <li key={step} className="text-subtle-foreground">
                  {step}
                </li>
              ))}
            </ol>
          </section>
          <section>
            <p className="text-xs font-bold uppercase tracking-widest text-subtle-foreground">
              Tips
            </p>
            <h2 className="font-display text-2xl mb-4 mt-1">Tips &amp; Strategy</h2>
            <ul className="list-disc list-inside space-y-2 marker:text-primary marker:font-bold">
              {config.tips.map((tip) => (
                <li key={tip} className="text-subtle-foreground">
                  {tip}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section>
          <p className="text-xs font-bold uppercase tracking-widest text-subtle-foreground">
            Common questions
          </p>
          <h2 className="font-display text-2xl mb-4 mt-1">Frequently Asked Questions</h2>
          <dl className="divide-y divide-border">
            {config.faq.map((item, i) => (
              <div key={i} className="py-5">
                <dt className="font-bold text-foreground mb-2">{item.q}</dt>
                <dd className="text-subtle-foreground">{item.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        {relatedGames.length > 0 && (
          <section>
            <p className="text-xs font-bold uppercase tracking-widest text-subtle-foreground">
              Next on the desk
            </p>
            <h2 className="font-display text-2xl mb-4 mt-1">
              More daily puzzles to play after {config.title}
            </h2>
            {/* Each card links with the game's real title as the anchor text and
                carries its own one-line description — these are the only
                in-content internal links a game page has, so they do the work of
                passing crawl signal to the rest of the roster. Keep the anchor
                text descriptive; don't collapse it back to "Play →". */}
            <div className="grid gap-3 sm:grid-cols-2">
              {relatedGames.map((game) => (
                <div
                  key={game.slug}
                  className="relative rounded-lg border border-border bg-card p-4 text-card-foreground transition-colors hover:border-primary"
                >
                  <div className="flex items-center gap-2">
                    {game.icon && <span aria-hidden="true">{game.icon}</span>}
                    <Link
                      href={game.path}
                      className="font-bold text-foreground after:absolute after:inset-0"
                    >
                      {game.title}
                    </Link>
                    <span className="ml-auto text-xs font-bold uppercase tracking-wide text-subtle-foreground">
                      {CATEGORY_LABELS[game.category]}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-subtle-foreground">{game.description}</p>
                </div>
              ))}
            </div>
            <p className="mt-5 text-sm text-subtle-foreground">
              Or browse{" "}
              <Link href={`/category/${config.category}`} className="text-link transition-colors hover:text-foreground">
                all {CATEGORY_LABELS[config.category].toLowerCase()} on the site
              </Link>{" "}
              and{" "}
              <Link href="/#game-index" className="text-link transition-colors hover:text-foreground">
                the full daily game list
              </Link>
              .
            </p>
          </section>
        )}
      </div>
    </section>
  );
}
