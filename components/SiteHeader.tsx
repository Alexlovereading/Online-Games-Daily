"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getCategories, getGamesByCategory, CATEGORY_LABELS } from "@/lib/games";

const navLinkClassName =
  "whitespace-nowrap rounded-md px-3 py-2 text-xs font-bold uppercase tracking-wide text-subtle-foreground transition-colors hover:bg-subtle hover:text-foreground";

const mobileNavLinkClassName =
  "rounded-md px-3 py-3 text-sm font-bold uppercase tracking-wide text-subtle-foreground transition-colors hover:bg-subtle hover:text-foreground";

const dropdownGameLinkClassName =
  "flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold text-subtle-foreground transition-colors hover:bg-subtle hover:text-foreground";

export function SiteHeader() {
  const categories = getCategories();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDrawerShown, setIsDrawerShown] = useState(false);
  const [openCategory, setOpenCategory] = useState<string | null>(null);

  const closeMenu = () => setIsMenuOpen(false);

  useEffect(() => {
    if (!isMenuOpen) {
      setIsDrawerShown(false);
      return;
    }

    // Mount off-screen first, then flip to the shown position on the next
    // frame so the transform transition actually animates in.
    const raf = requestAnimationFrame(() => setIsDrawerShown(true));

    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen]);

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
      <div className="site-shell relative flex items-center justify-between gap-4 py-4">
        <Link
          className="flex items-center gap-2 font-display text-lg font-bold text-foreground"
          href="/"
          aria-label="Online Games Daily home"
        >
          <span
            className="flex h-8 w-8 items-center justify-center rounded-md bg-primary font-display italic text-primary-foreground"
            aria-hidden="true"
          >
            O
          </span>
          <span>Online Games Daily</span>
        </Link>

        <nav aria-label="Main navigation" className="hidden items-center gap-1 lg:flex">
          <Link href="/" className={navLinkClassName}>
            Home
          </Link>
          {categories.map((cat, index) => {
            const liveGames = getGamesByCategory(cat).filter((game) => game.status === "live");
            const isLast = index === categories.length - 1;
            const isOpen = openCategory === cat;

            return (
              <div
                key={cat}
                className="relative"
                onMouseEnter={() => setOpenCategory(cat)}
                onMouseLeave={() => setOpenCategory((current) => (current === cat ? null : current))}
              >
                <Link href={`/category/${cat}`} className={navLinkClassName}>
                  {CATEGORY_LABELS[cat]}
                </Link>

                {liveGames.length > 0 && (
                  <div
                    className={`absolute top-full z-30 mt-2 flex w-52 flex-col gap-0.5 rounded-lg border border-border bg-card p-2 shadow-xl transition-[opacity,transform] duration-150 ${
                      isLast ? "right-0" : "left-0"
                    } ${
                      isOpen
                        ? "dropdown-in visible opacity-100"
                        : "invisible -translate-y-1 opacity-0"
                    }`}
                  >
                    {liveGames.map((game) => (
                      <Link
                        href={game.path}
                        key={game.slug}
                        className={dropdownGameLinkClassName}
                        tabIndex={isOpen ? undefined : -1}
                        onClick={() => setOpenCategory(null)}
                      >
                        <span aria-hidden="true">{game.icon}</span>
                        <span>{game.title}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          <Link href="/about" className={navLinkClassName}>
            About
          </Link>
        </nav>

        <button
          type="button"
          className="flex h-9 w-9 flex-col items-center justify-center gap-1.5 rounded-md transition-colors hover:bg-subtle lg:hidden"
          aria-label="Toggle navigation menu"
          aria-expanded={isMenuOpen}
          aria-controls="mobile-nav-menu"
          onClick={() => setIsMenuOpen((open) => !open)}
        >
          <span
            className={`block h-0.5 w-6 bg-foreground transition-transform ${
              isMenuOpen ? "translate-y-2 rotate-45" : ""
            }`}
          />
          <span className={`block h-0.5 w-6 bg-foreground transition-opacity ${isMenuOpen ? "opacity-0" : ""}`} />
          <span
            className={`block h-0.5 w-6 bg-foreground transition-transform ${
              isMenuOpen ? "-translate-y-2 -rotate-45" : ""
            }`}
          />
        </button>

        {isMenuOpen && (
          <>
            <div
              aria-hidden="true"
              onClick={closeMenu}
              className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 lg:hidden ${
                isDrawerShown ? "opacity-100" : "opacity-0"
              }`}
            />

            <nav
              id="mobile-nav-menu"
              aria-label="Mobile navigation"
              className={`fixed right-0 top-0 z-50 flex h-dvh w-1/2 max-w-xs flex-col gap-1 border-l border-border bg-background p-4 shadow-lg transition-transform duration-300 ease-out lg:hidden ${
                isDrawerShown ? "translate-x-0" : "translate-x-full"
              }`}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="font-display text-base font-bold text-foreground">Menu</span>
                <button
                  type="button"
                  aria-label="Close navigation menu"
                  onClick={closeMenu}
                  className="flex h-9 w-9 items-center justify-center rounded-md text-xl leading-none text-subtle-foreground transition-colors hover:bg-subtle hover:text-foreground"
                >
                  ×
                </button>
              </div>

              <Link href="/" className={mobileNavLinkClassName} onClick={closeMenu}>
                Home
              </Link>

              <div className="my-1 border-t border-border" />

              {categories.map((cat) => (
                <Link
                  href={`/category/${cat}`}
                  key={cat}
                  className={mobileNavLinkClassName}
                  onClick={closeMenu}
                >
                  {CATEGORY_LABELS[cat]}
                </Link>
              ))}

              <div className="my-1 border-t border-border" />

              <Link href="/about" className={mobileNavLinkClassName} onClick={closeMenu}>
                About
              </Link>
            </nav>
          </>
        )}
      </div>
    </header>
  );
}
