import Link from "next/link";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { CATEGORY_LABELS, type GameConfig } from "@/lib/games";

export function GameCard({ game, index }: { game: GameConfig; index: number }) {
  const isLive = game.status === "live";
  const accent = game.color ?? "var(--primary)";

  const thumbnail = (
    <div
      className="relative flex aspect-[4/3] items-center justify-center overflow-hidden"
      style={{
        backgroundImage: `linear-gradient(135deg, ${accent}, color-mix(in srgb, ${accent} 55%, white))`,
      }}
    >
      <div
        className="absolute inset-[-20%] pointer-events-none"
        style={{
          backgroundImage: "linear-gradient(135deg, transparent 40%, rgba(255,255,255,0.18) 50%, transparent 60%)",
          animation: "card-shimmer-sweep 6s ease-in-out infinite",
        }}
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full"
        aria-hidden="true"
      />
      {game.icon && (
        <span
          className="select-none text-6xl drop-shadow-lg transition-transform duration-300 motion-safe:animate-[card-float_3s_ease-in-out_infinite] group-hover:scale-110 group-hover:rotate-6 sm:text-7xl"
          style={{ animationDelay: `-${(index * 0.4) % 3}s` }}
          aria-hidden="true"
        >
          {game.icon}
        </span>
      )}
      <Badge variant="default" className="absolute right-2.5 top-2.5 border-0 bg-black/40 text-white shadow-sm ring-1 ring-white/10 backdrop-blur-sm">
        {CATEGORY_LABELS[game.category]}
      </Badge>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent px-4 pb-3 pt-12">
        <h3 className="font-display text-lg font-bold leading-tight tracking-tight text-white drop-shadow-sm line-clamp-1">{game.title}</h3>
      </div>
    </div>
  );

  return (
    <article className={cn(
      "group relative flex flex-col overflow-hidden rounded-lg border border-border bg-card shadow-md",
      isLive ? "transition-all duration-200 ease-out hover:-translate-y-1.5 hover:border-primary/40 hover:shadow-xl" : "opacity-70",
    )}>
      {isLive ? <Link href={game.path} aria-label={`Play ${game.title}`}>{thumbnail}</Link> : thumbnail}
      <div className="flex items-center justify-between gap-2 border-t border-border/60 px-4 py-3">
        <span className="font-display text-xs italic tracking-wide text-subtle-foreground">0{index + 1}</span>
        {isLive ? (
          <Link href={game.path} className={buttonVariants({ variant: "primary", size: "sm" })}>Play <span aria-hidden="true">→</span></Link>
        ) : (
          <Badge variant="default">Coming soon</Badge>
        )}
      </div>
    </article>
  );
}
