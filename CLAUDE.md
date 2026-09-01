# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Online Games Daily — a free, independent daily puzzle site (14 games across Word,
Math, Trivia, Memory, and Card categories). One fresh puzzle per game every day at
UTC midnight, no accounts. The site itself is statically exported with Next.js —
no server-side session, no per-request backend for any game logic. The one
exception is a small Cloudflare Worker that backs the cross-player leaderboard
feature (D1-backed; see Architecture below) — everything else (puzzle generation,
progress, stats) is still a pure function of the date, computed client-side.

Stack: Next.js 16 (App Router, `output: "export"`), React 19, TypeScript, Tailwind
CSS v4 (CSS-first `@theme inline` config lives in `app/globals.css`, no separate
`tailwind.config.*`), Radix UI primitives + a small `class-variance-authority`/`cn()`
layer (`components/ui/`), Vitest for unit tests.

## Commands

```bash
pnpm install
pnpm dev              # next dev
pnpm typecheck        # tsc --noEmit (the Next.js app)
pnpm typecheck:worker # tsc --noEmit -p workers/tsconfig.json (the leaderboard Worker — separate tsconfig, excluded from the app's)
pnpm test             # vitest run — all tests
pnpm build             # next build --webpack, static export to out/
```

Single test file: `pnpm exec vitest run tests/daily.test.ts` (there is no
`vitest.config.*` — tests are plain Vitest defaults, no DOM/jsdom setup, since they
test pure logic functions directly).

`pnpm dev` and `pnpm build` both run a `predev`/`prebuild` step first
(`scripts/copy-word-groups.js`, `scripts/generate-og-images.mjs`) that syncs puzzle
data into `public/` and generates any missing per-game OG images. OG generation
skips files that already exist — delete a game's PNG under `public/og/` to force a
regenerate (e.g. after changing its icon/color).

To inspect the exact static export output, serve `out/` after `pnpm build`, e.g.
`npx serve out` — this won't exercise the leaderboard Worker (see Deployment), only
the static pages.

`.env.example` → `.env.local` for local overrides. `NEXT_PUBLIC_SITE_URL` (falls
back to `https://onlinegamesdaily.com` in `lib/site.ts`) drives every canonical URL,
sitemap entry, OG image URL, and JSON-LD `url` field — must be set correctly before
a production deploy since there's no server to compute it at request time.

`pnpm indexnow` (`scripts/indexnow-ping.mjs`) pings the IndexNow API with every live
URL. It's manual/optional, not wired into `predev`/`prebuild` — run it by hand after
a production deploy if faster Bing/Yandex recrawl matters.

To test the leaderboard Worker locally against a local D1 emulator:
`npx wrangler dev` (add `--test-scheduled` to be able to trigger the cron handler
via `curl -X POST http://localhost:8787/__scheduled`). The local D1 database is
separate from production — seed/inspect it with
`npx wrangler d1 execute online-games-daily-leaderboard --local --command "..."`;
drop `--local` (or use `--remote`) to hit the real production database directly.

## Deployment

Deploys are manual: `pnpm build` then `npx wrangler deploy` (Cloudflare Workers,
per `wrangler.jsonc`) — this uploads both the static assets and the leaderboard
Worker script (`workers/api.ts`) in one step. The production custom domain
(onlinegamesdaily.com) is bound to the Worker via the Cloudflare dashboard, not
`wrangler.jsonc` (there's no `routes` field in-repo) — `wrangler deploy` alone is
enough to ship once that binding exists. `wrangler login` credentials can expire
between sessions; `npx wrangler whoami` confirms auth before deploying.

`.github/workflows/daily-rebuild.yml` runs a scheduled (00:02 UTC) rebuild +
redeploy so the "today" date baked into static HTML at build time doesn't go stale
between manual deploys — it needs a `CLOUDFLARE_API_TOKEN` repo secret to actually
run; a `workflow_dispatch` trigger lets you run it manually to verify that secret
is configured. This does not replace manual `wrangler deploy` for actual code
changes — it only rebuilds from whatever is already on `main`.

`public/_headers` (copied into `out/_headers` by the build) sets `Cache-Control`
and security headers (HSTS, X-Content-Type-Options, etc.); Cloudflare Workers
Static Assets honors this file the same way Cloudflare Pages does.

The live `robots.txt` is not just what `app/robots.ts` emits: Cloudflare injects an
edge-level "AI Crawl Control" policy (dashboard: Security → Bots) that layers
per-bot `Disallow` rules for AI-training crawlers (e.g. `GPTBot`, `ClaudeBot`,
`CCBot`, `Google-Extended`) on top of it, controlled by three independent
dashboard toggles (Search / Agent / Training) plus a separate legacy "Block AI
bots" rule. None of this is in version control — when debugging crawler-access or
GEO issues, check the live `curl https://onlinegamesdaily.com/robots.txt` output
and the dashboard, not just `app/robots.ts`. Note this is distinct from the
per-crawler "Block Crawler" toggles under AI Crawl Control → Security in the same
dashboard section — a bot can show real allowed traffic there (e.g. Claude's
search-time crawler) while its training-crawler counterpart is blocked elsewhere.

## Architecture

**Deterministic daily content** (`lib/daily.ts`) is the core mechanic every game
engine relies on: every player sees the same puzzle on the same UTC date, with no
server round-trip. `getUtcDateKey()` + `fnv1a32(dateKey + ":" + slug)` seeds a
Mulberry32 PRNG (`makeSeededRng`) — puzzle generation is a pure function of
(date, slug). `components/UtcDayRollover.tsx` (mounted once in `app/layout.tsx`)
force-reloads the page ~100ms after UTC midnight, so no individual game engine needs
its own "did the day change while this tab was open" logic. Anywhere a component
needs "today" for display (not just puzzle seeding) — e.g. `DateStamp.tsx`, each
engine's own date display, the `Leaderboard` component's date — the pattern is to
compute it server-side once (in the enclosing Server Component) and pass it down as
an `initialDateKey`/`dateKey` prop, then self-correct against the browser's real
clock in a `useEffect` on mount. This matters because the site has no per-request
server: a stale static build (see the daily-rebuild workflow above) would otherwise
show yesterday's date until the next deploy without this self-correction.

**The game roster is entirely data-driven from `config/games.json`.** Each entry's
`priority` field controls display order everywhere — homepage default/featured game,
per-category tab order, nav dropdown order (`lib/games.ts`). Lower `priority` shows
first. Exactly one game must have `"featured": true`. `getCategories()` derives
category display order automatically from the first (lowest-priority) game in each
category, so there's no separate ordering list to maintain in sync.

**`lib/engine-registry.ts` is the single wiring point between config and code** —
it maps each game's `engine` key (from `config/games.json`) to its React component,
loaded via `next/dynamic` so each game ships as its own JS chunk (a visitor playing
one game never downloads the other 13 engines' code). `app/[slug]/page.tsx` and
`components/GameSwitcher.tsx` (the homepage's and category pages' in-place game
switcher) both resolve through `getEngineComponent()` — never import a game engine
directly elsewhere. Every engine component takes a required `initialDateKey: string`
prop (see `EngineProps` in `lib/engine-registry.ts`).

**Adding a new game:**
1. Build the engine under `game-engines/<slug>/` — a `"use client"` component
   accepting `{ initialDateKey: string }`; it reads the daily seed itself via
   `lib/daily.ts`.
2. Register it in `lib/engine-registry.ts`.
3. Add an entry to `config/games.json` (slug, title, description, icon, color, path,
   engine key, category, priority, keywords, faq, tips, howToPlay).
4. If the game should have a leaderboard, add an entry to
   `lib/leaderboard-config.ts` (metric direction, unit, plausibility bounds) and
   call `submitLeaderboardScore()` from `lib/leaderboard-client.ts` at the engine's
   win/completion point — see the Leaderboard subsection below.
5. Nothing else needs to change — routing (`app/[slug]/page.tsx`), sitemap,
   category pages, and nav all derive from `config/games.json` automatically.

**Shared multi-question engine pattern**: `game-engines/trivia/TriviaEngine.tsx` is
a generic multiple-choice "daily quiz" state machine (shuffle/score/feedback-delay/
localStorage wiring) parameterized by a dataset + accessor functions; specific
trivia games (e.g. `CapitalQuizGame.tsx`) are thin wrappers that just supply the
dataset. Follow this pattern rather than duplicating the quiz state machine if
adding another multiple-choice trivia game.

**Progress/stats are client-side only**, under the `dgh:*` localStorage key prefix
(`lib/stats.ts` for the `GameStats` shape — lastDateKey/streak/maxStreak/played/
wins/lastResult; `lib/storage.ts` for the try/catch-wrapped read/write, since Safari
private mode throws on localStorage access). One recorded result per game per UTC
date; writes are idempotent for a repeated call on the same `dateKey`. This data
never leaves the device — it's separate from the leaderboard system below, which
does have a backend.

### Leaderboard (the one backend in this project)

Daily + all-time cross-player leaderboards, backed by Cloudflare D1
(`online-games-daily-leaderboard`) and a Worker (`workers/api.ts`, wired in via
`wrangler.jsonc`'s `main` field). The Worker handles `/api/leaderboard/*` and falls
through to `env.ASSETS.fetch(request)` for everything else — the static export
itself is completely unaffected by the Worker's existence.

- **`lib/leaderboard-config.ts`** is the single source of truth for every game's
  leaderboard metric — direction (`higher_is_better`/`lower_is_better`), unit, and
  plausibility bounds (`min`/`max`, derived from real game mechanics, e.g. Snake's
  max is 80 because the engine only pre-generates 80 food coordinates/day). It has
  no Next.js-specific imports, so both the frontend and the Worker import it
  directly — wrangler's bundler pulls it straight into the Worker build (see
  `workers/tsconfig.json`'s `include`). Sudoku is the one game with more than one
  leaderboard slug (`daily-sudoku-easy/medium/hard`, one per difficulty) since
  its own page slug (`daily-sudoku`) isn't a single leaderboard.
- **`lib/leaderboard-client.ts`**: frontend fetch helpers
  (`submitLeaderboardScore`/`fetchDailyLeaderboard`/`fetchAllTimeLeaderboard`) plus
  anonymous per-device player ID + editable nickname in localStorage — no accounts,
  consistent with the rest of the site. A successful submission dispatches a
  `LEADERBOARD_SUBMITTED_EVENT` window event so a mounted `<Leaderboard>` for the
  same game can refetch instead of showing a stale list.
- **`components/Leaderboard.tsx`** is rendered generically by `GameLayout.tsx` (13
  of 14 games) and by `GameSwitcher.tsx` (the homepage/category-page switcher),
  gated on `getLeaderboardConfig(slug)` returning non-null. Sudoku is the
  exception: it renders its own `<Leaderboard>` internally (keyed to whichever
  difficulty is currently selected), since neither of those generic callers knows
  the active difficulty.
- **Anti-cheat is intentionally limited to**: rate limiting (60 submissions/IP/hour,
  a single atomic `INSERT ... SELECT ... WHERE (count) < limit` statement so
  concurrent requests can't race past the limit, hashed IP never stored raw) and
  server-side plausibility-bound rejection per `lib/leaderboard-config.ts`. There is
  no gameplay/replay verification — a sufficiently motivated client can still fake a
  score within the plausible range.
- **`workers/api.ts`'s `scheduled()` handler** runs hourly (`wrangler.jsonc`'s
  `triggers.crons`) and does two things: prunes expired `submission_log` rows
  (rate-limit bookkeeping), and re-dates any `scores` row with `is_seed = 1` still
  on a previous UTC day to today. That second part keeps placeholder/seed data
  (inserted once by hand to avoid an empty leaderboard before real traffic exists)
  looking current without ever needing manual reseeding — real submissions use the
  real date already and rank in alongside seed rows normally, with no other query
  needing to know `is_seed` exists. Remove seed rows permanently with
  `DELETE FROM scores WHERE is_seed = 1` once real player volume no longer needs
  the padding.
- **`lib/name-filter.ts`**: a basic profanity blocklist (substring match on a
  normalized name) shared by the client (for immediate UX feedback when editing a
  nickname) and the Worker (the actual enforcement — a blocked name silently
  becomes "Anonymous" rather than rejecting the whole score submission).

**ARIA grid boards**: several game engines (sudoku, minesweeper, word-search,
2048, cupcake-2048, memory) render a `role="grid"` board where gridcells must be
grandchildren, not direct children, of the grid (via `role="row"` wrappers). Two
techniques are used depending on how the board is built: (a) split a single CSS
Grid into an outer rows-only grid containing one column-grid per row (see
`.sudoku-board`/`.sudoku-row` in `app/globals.css`), or (b) for boards built from a
flat cell array, wrap row-chunks in the `.a11y-grid-row` utility class
(`display: contents`) so the ARIA row wrapper has zero effect on the existing
single-level CSS Grid layout. Connect Four is the exception: it's column-major
(each column is one clickable drop-target spanning multiple cells), which doesn't
fit grid/row/gridcell semantics, so it uses `role="group"` with each column's full
state folded into that column button's `aria-label` instead.

**Attribution**: several game engines are adapted from MIT-licensed open-source
projects, with upstream attribution, pinned commit SHAs, and license text recorded
in `NOTICE`. Games without a `NOTICE` entry are original implementations.
`app/licenses/page.tsx` parses and publishes `NOTICE` at build time
(`fs.readFileSync` inside the page component — safe under `output: "export"` since
it only runs during static generation, never at request time). If you edit
`NOTICE`'s structure (the `Project:`/`Repository:` fields, the `----` divider
between entries), update the parser in that file to match.
