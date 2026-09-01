import Link from "next/link";
import { getCategories, getLiveGames, CATEGORY_LABELS } from "@/lib/games";

const footerLinkClassName = "text-sm text-subtle-foreground transition-colors hover:text-primary";

const columnLabelClassName = "text-xs font-bold uppercase tracking-wide text-subtle-foreground";

export function SiteFooter() {
  const categories = getCategories();
  const liveGameCount = getLiveGames().length;

  return (
    <footer className="border-t border-border bg-background">
      <div className="site-shell grid grid-cols-1 gap-10 py-12 sm:grid-cols-3 sm:gap-8">
        <div className="sm:col-span-1">
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
          <p className="mt-3 max-w-xs text-sm text-subtle-foreground">
            {liveGameCount} free daily puzzle games — independent, calm, and built for the daily
            ritual. New days begin at 00:00 UTC.
          </p>
        </div>

        <div>
          <p className={columnLabelClassName}>Categories</p>
          <nav aria-label="Footer categories" className="mt-4 flex flex-col gap-3">
            {categories.map((cat) => (
              <Link key={cat} href={`/category/${cat}`} className={footerLinkClassName}>
                {CATEGORY_LABELS[cat]}
              </Link>
            ))}
          </nav>
        </div>

        <div>
          <p className={columnLabelClassName}>Site</p>
          <nav aria-label="Footer site links" className="mt-4 flex flex-col gap-3">
            <Link href="/" className={footerLinkClassName}>
              Home
            </Link>
            <Link href="/about" className={footerLinkClassName}>
              About
            </Link>
            <Link href="/privacy" className={footerLinkClassName}>
              Privacy
            </Link>
            <Link href="/licenses" className={footerLinkClassName}>
              Licenses
            </Link>
            <a href="mailto:contact@onlinegamesdaily.com" className={footerLinkClassName}>
              Contact
            </a>
          </nav>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="site-shell py-6">
          <p className="text-sm text-subtle-foreground">
            © {new Date().getFullYear()} Online Games Daily. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
