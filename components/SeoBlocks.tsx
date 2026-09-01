import Link from "next/link";
import { getGameBySlug, type GameConfig } from "@/lib/games";

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
            <h2 className="font-display text-2xl mb-4 mt-1">Related games</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {relatedGames.map((game) => (
                <Link
                  href={game.path}
                  key={game.slug}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-4 text-card-foreground transition-colors hover:border-primary"
                >
                  <span>{game.title}</span>
                  <span aria-hidden="true">→</span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </section>
  );
}
