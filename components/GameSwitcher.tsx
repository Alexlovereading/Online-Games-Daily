"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Leaderboard } from "@/components/Leaderboard";
import { SeoBlocks } from "@/components/SeoBlocks";
import { getEngineComponent } from "@/lib/engine-registry";
import { getLeaderboardConfig } from "@/lib/leaderboard-config";
import type { GameConfig } from "@/lib/games";

type GameSwitcherProps = {
  games: GameConfig[];
  defaultSlug?: string;
  initialDateKey: string;
};

export function GameSwitcher({ games, defaultSlug, initialDateKey }: GameSwitcherProps) {
  const playable = games.filter((g) => g.status === "live");

  const initialSlug =
    (defaultSlug && playable.find((g) => g.slug === defaultSlug)?.slug) ??
    playable[0]?.slug;

  const [activeSlug, setActiveSlug] = useState(initialSlug);

  const tabsListRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const rafRef = useRef<number | null>(null);

  const updateScrollState = () => {
    const el = tabsListRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  };

  useEffect(() => {
    updateScrollState();
    const el = tabsListRef.current;
    if (!el) return;
    const onScroll = () => {
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        updateScrollState();
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    const resizeObserver = new ResizeObserver(onScroll);
    resizeObserver.observe(el);
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      resizeObserver.disconnect();
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playable.length]);

  // The active tab isn't always first in the list (e.g. landing directly on
  // a game's own page). Without this, the horizontally-scrollable tab strip
  // stays at scrollLeft 0 and clips/hides the active tab on narrow screens.
  useEffect(() => {
    const el = tabsListRef.current;
    if (!el) return;
    const activeTab = el.querySelector<HTMLElement>('[data-state="active"]');
    activeTab?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [activeSlug]);

  const scrollByPage = (direction: 1 | -1) => {
    const el = tabsListRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth, behavior: "smooth" });
  };

  if (!playable.length) return null;

  const activeGame = playable.find((g) => g.slug === activeSlug) ?? playable[0];
  const EngineComponent = getEngineComponent(activeGame.engine);
  // Sudoku renders its own Leaderboard internally (one per difficulty, via
  // lib/leaderboard-config.ts's daily-sudoku-easy/medium/hard entries), so
  // getLeaderboardConfig("daily-sudoku") naturally returns null here and
  // this generic render is skipped for it — same pattern GameLayout uses.
  const leaderboardConfig = getLeaderboardConfig(activeGame.slug);

  return (
    <div className="min-w-0">
      <Tabs className="min-w-0" value={activeGame.slug} onValueChange={setActiveSlug}>
        <div className="relative min-w-0 flex items-center gap-3">
          <button
            type="button"
            aria-label="Scroll games left"
            onClick={() => scrollByPage(-1)}
            disabled={!canScrollLeft}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm transition-colors hover:border-primary hover:bg-subtle disabled:pointer-events-none disabled:opacity-40"
          >
            <span aria-hidden="true">‹</span>
          </button>

          <TabsList ref={tabsListRef} aria-label="Choose a game" className="min-w-0 flex-1">
            {playable.map((game) => (
              <TabsTrigger
                key={game.slug}
                value={game.slug}
                style={{ "--tab-accent": game.color ?? "var(--primary)" } as CSSProperties}
              >
                {game.icon && <span aria-hidden="true">{game.icon}</span>}
                {game.title}
              </TabsTrigger>
            ))}
          </TabsList>

          <button
            type="button"
            aria-label="Scroll games right"
            onClick={() => scrollByPage(1)}
            disabled={!canScrollRight}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm transition-colors hover:border-primary hover:bg-subtle disabled:pointer-events-none disabled:opacity-40"
          >
            <span aria-hidden="true">›</span>
          </button>
        </div>

        {/* 同一时刻只挂载一个引擎组件——TabsContent 默认只挂载 value 匹配当前
            activeGame.slug 的面板(未传 forceMount)，切换 tab 时 Radix 会先卸载
            前一个引擎(连带它的全局 keydown 监听器)再挂载新引擎。
            key 是防御性的双重保险，非必需但保留。 */}
        <TabsContent value={activeGame.slug}>
          <div
            key={activeGame.slug}
            className="mx-auto mt-6 min-w-0 w-full max-w-[720px] overflow-x-auto rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6"
          >
            {EngineComponent ? (
              <EngineComponent initialDateKey={initialDateKey} />
            ) : (
              <p className="p-10 text-center text-subtle-foreground">
                {activeGame.title} is coming soon.
              </p>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {leaderboardConfig && <Leaderboard slug={activeGame.slug} dateKey={initialDateKey} />}

      <div className="mt-10">
        <SeoBlocks config={activeGame} />
      </div>
    </div>
  );
}
