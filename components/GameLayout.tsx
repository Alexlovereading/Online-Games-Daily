import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { Ads } from "@/components/Ads";
import { DateStamp } from "@/components/DateStamp";
import { Leaderboard } from "@/components/Leaderboard";
import { PageAdRails } from "@/components/PageAdRails";
import { SeoBlocks } from "@/components/SeoBlocks";
import { getUtcDateKey } from "@/lib/daily";
import { getLeaderboardConfig } from "@/lib/leaderboard-config";
import { CATEGORY_LABELS, type GameConfig } from "@/lib/games";

type GameLayoutProps = {
  config: GameConfig;
  children: ReactNode;
};

export function GameLayout({ config, children }: GameLayoutProps) {
  const isLive = config.status === "live";
  const categoryLabel = CATEGORY_LABELS[config.category];
  const todayKey = getUtcDateKey();
  // Sudoku has one leaderboard per difficulty (see lib/leaderboard-config.ts)
  // and renders its own Leaderboard from inside the engine, where the
  // currently selected difficulty is known — skip the generic render here.
  const leaderboardConfig = getLeaderboardConfig(config.slug);

  return (
    <main className="pb-24" style={{ "--game-accent": config.color ?? "#d7ff58" } as CSSProperties}>
      <section className="site-shell pt-12 pb-8">
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-subtle-foreground"
        >
          <Link href="/" className="text-link transition-colors hover:text-foreground">
            Home
          </Link>
          <span aria-hidden="true" className="text-subtle-foreground/50">/</span>
          <Link href={`/category/${config.category}`} className="text-link transition-colors hover:text-foreground">
            {categoryLabel}
          </Link>
          <span aria-hidden="true" className="text-subtle-foreground/50">/</span>
          <span className="text-foreground">{config.title}</span>
        </nav>
        <div className="game-title-block mt-5 flex flex-col items-start gap-5 sm:flex-row sm:items-center">
          {config.icon && (
            <span
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-border bg-card text-3xl shadow-sm"
              style={{ boxShadow: "inset 0 -3px 0 0 var(--game-accent)" }}
              aria-hidden="true"
            >
              {config.icon}
            </span>
          )}
          <div className="min-w-0">
            <p
              className="text-xs font-bold uppercase tracking-widest mb-2"
              style={{ color: "var(--game-accent)" }}
            >
              Daily edition / {String(config.priority).padStart(2, "0")}
            </p>
            <h1 className="font-display text-4xl sm:text-6xl font-bold text-foreground">{config.title}</h1>
            <p className="mt-4 max-w-2xl text-lg text-subtle-foreground">{config.description}</p>
            {config.daily && isLive && (
              <div className="mt-2">
                <DateStamp initialDateKey={todayKey} />
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="mt-8">
        <PageAdRails>
          <div className="mx-auto w-full max-w-[720px] min-w-0 overflow-x-auto rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">{children}</div>
        </PageAdRails>
      </div>

      {leaderboardConfig && isLive && <Leaderboard slug={config.slug} dateKey={todayKey} />}

      <div className="mt-16"><SeoBlocks config={config} /></div>

      <div className="site-shell mt-4 pb-16">
        <Ads variant="bottom" />
      </div>
    </main>
  );
}
