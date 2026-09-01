import type { Metadata } from "next";
import { siteUrl } from "@/lib/site";
import { getLiveGames } from "@/lib/games";

export const metadata: Metadata = {
  title: "About",
  description: `Learn about Online Games Daily — ${getLiveGames().length} free daily puzzle games across five categories, no accounts required, built for a quick brain warm-up every day.`,
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  const liveGames = getLiveGames();

  const orgSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Online Games Daily",
    url: siteUrl,
    logo: `${siteUrl}/logo.png`,
    description: `Independent daily puzzle game website offering ${liveGames.length} free word, math, trivia, memory, and card games refreshed every day at midnight UTC.`,
    email: "contact@onlinegamesdaily.com",
    foundingDate: "2026",
  };


  const safeJson = (obj: unknown) => JSON.stringify(obj).replace(/</g, "\\u003c");

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJson(orgSchema) }} />
    <main className="prose-page site-shell [&_a]:underline [&_a]:underline-offset-2 [&_a]:decoration-border [&_a]:transition-colors [&_a:hover]:text-primary [&_a:hover]:decoration-primary">
      <p className="eyebrow">About the desk</p>
      <h1>A small place for good puzzles.</h1>
      <p className="prose-lede">
        Online Games Daily is an independent collection built around a simple idea: a curated set of
        daily games, refreshed every day, is better than an endless arcade you never finish.
      </p>

      <div className="prose-grid">
        <section>
          <h2>What this site is</h2>
          <p>
            Online Games Daily offers {liveGames.length} free daily puzzle games across five categories — Word Games,
            Math Games, Trivia Games, Memory Games, and Card Games. Titles include The Daily Word,
            Sudoku, Cupcake 2048, and Connect Four, alongside many others. Each game publishes one fresh
            puzzle per day, timed to UTC midnight so everyone on the planet plays the same edition
            on the same day.
          </p>
          <p>
            There are no accounts to create, no email addresses to hand over, and no sign-up walls.
            Your progress is tracked automatically in your browser so you can pick up where you left
            off. Because we use UTC dates rather than local time, your streak never resets because
            you played just after midnight in a different timezone.
          </p>
        </section>

        <section>
          <h2>Why it exists</h2>
          <p>
            The site was built for people who enjoy a brief, focused daily puzzle ritual — the kind
            of 5–10 minute brain warm-up that fits any schedule. Whether you reach for a puzzle with
            your morning coffee or use it to decompress at lunch, the games are designed to be
            satisfying without being addictive.
          </p>
          <p>
            Games are deliberately distraction-free: no pop-ups, no timers counting down to make
            you anxious, no social pressure. Every puzzle works on any device — desktop, tablet, or
            phone — with no app download required.
          </p>
        </section>

        <section>
          <h2>How we build it</h2>
          <p>
            Several game engines are adapted from MIT-licensed open-source projects, with full
            attribution and license text kept alongside the source of each upstream project — see
            the full record on our <a href="/licenses">Licenses &amp; Credits</a> page.
          </p>
          <p>
            The site is built with Next.js and deployed to Cloudflare Pages for fast global
            delivery. There is no database, no server-side session, and no backend that knows who
            you are. Game progress and statistics are saved locally in your browser&rsquo;s
            localStorage. Nothing leaves your device.
          </p>
        </section>

        <section className="md:col-span-2">
          <h2>About your data</h2>
          <p>
            Your game progress and statistics are stored only in your browser&rsquo;s localStorage.
            We do not collect personal information or send your data to any server. If you clear
            your browser data, your progress will reset — that is the only side effect of the
            privacy-first approach we have chosen.
          </p>
          <p>
            The site does display ads through Google AdSense, which may set cookies to serve
            relevant advertising. You can learn more and manage your ad preferences in our{" "}
            <a href="/privacy">Privacy Policy</a>.
          </p>
        </section>

        <section className="md:col-span-1 md:bg-card/40">
          <h2>Contact</h2>
          <p>
            Questions or feedback? Reach us at:{" "}
            <a href="mailto:contact@onlinegamesdaily.com">contact@onlinegamesdaily.com</a>
          </p>
          <p>We aim to respond within 2 business days.</p>
        </section>
      </div>
    </main>
    </>
  );
}
