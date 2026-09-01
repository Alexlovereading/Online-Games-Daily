import type { ReactNode } from "react";
import { Ads } from "@/components/Ads";

/**
 * Wraps game-switcher/game-board content in a 3-column layout: narrow sticky
 * ad rails in the leftover viewport space outside the centered content on
 * wide screens, hidden entirely below the lg breakpoint (mobile gets no rail
 * ads — just the single bottom Ads slot each page adds separately).
 *
 * The middle column uses minmax(0, ...) + min-w-0 so wide inner content
 * (like GameSwitcher's tab list) is forced to scroll within itself via its
 * own overflow-x-auto instead of blowing out this grid's track width and
 * causing the whole page to scroll horizontally.
 */
export function PageAdRails({ children }: { children: ReactNode }) {
  return (
    <div className="grid w-full grid-cols-1 justify-center gap-4 lg:grid-cols-[minmax(140px,1fr)_minmax(0,1180px)_minmax(140px,1fr)] lg:gap-6 xl:gap-10">
      <aside className="hidden lg:flex lg:justify-end">
        <div className="sticky top-24 w-[140px]">
          <Ads variant="rail" />
        </div>
      </aside>
      <div className="min-w-0 w-full">{children}</div>
      <aside className="hidden lg:flex lg:justify-start">
        <div className="sticky top-24 w-[140px]">
          <Ads variant="rail" />
        </div>
      </aside>
    </div>
  );
}
