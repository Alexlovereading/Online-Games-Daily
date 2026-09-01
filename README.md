# Online Games Daily

A free, independent daily puzzle site — one fresh puzzle per game, every day at UTC
midnight, no accounts. 14 games across five categories (Word, Math, Trivia, Memory,
Card). Statically exported with Next.js and deployed to Cloudflare Pages: no
database, no server-side session, no backend.

## Stack

- Next.js 16 (App Router, `output: "export"`), React 19, TypeScript
- Tailwind CSS v4 (CSS-first `@theme inline` config in `app/globals.css`)
- Radix UI primitives + a small `class-variance-authority`/`cn()` component layer (`components/ui/`)
- Vitest for unit tests
- Deployed as static assets via Cloudflare Wrangler (`wrangler.jsonc`)

## Local development

```bash
pnpm install
pnpm dev
```

Quality checks:

```bash
pnpm typecheck
pnpm test
pnpm build
```

`pnpm build` writes the static export to `out/`. To inspect that exact output
locally, serve it with any static file server, e.g. `npx serve out`.

Both `pnpm dev` and `pnpm build` run a `predev`/`prebuild` step first
(`scripts/copy-word-groups.js`, `scripts/generate-og-images.mjs`) that syncs
puzzle data into `public/` and generates any missing per-game OG images. OG
image generation skips files that already exist — delete a game's PNG under
`public/og/` to force it to regenerate (e.g. after changing its icon/color).

## Environment variables

Copy `.env.example` to `.env.local` for local overrides. In production
(Cloudflare Pages), set:

- `NEXT_PUBLIC_SITE_URL` — the canonical production origin, no trailing slash.
  Drives every canonical URL, sitemap entry, OG image URL, and JSON-LD `url`
  field. Falls back to `https://onlinegamesdaily.com` if unset (see `lib/site.ts`).
- `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` — optional; injects the Search Console
  ownership `<meta>` tag when set.

## Architecture

- **Deterministic daily content** (`lib/daily.ts`): every player sees the same
  puzzle on the same UTC date. `getUtcDateKey()` + `fnv1a32(dateKey + ":" + slug)`
  seeds a Mulberry32 PRNG (`makeSeededRng`), so puzzle generation is pure and
  reproducible from just the date and game slug — no server round-trip needed.
- **Game roster is data-driven** (`config/games.json`): each entry's `priority`
  field controls display order everywhere (homepage default game, per-category
  tab order, nav dropdown order) — see `lib/games.ts`. Lower `priority` = shown
  first. Exactly one game should have `"featured": true` (the homepage default).
  `getCategories()` derives category display order automatically from the first
  (lowest-priority) game in each category — no separate ordering list to maintain.
- **Engine registry** (`lib/engine-registry.ts`): maps each game's `engine` key
  (from `config/games.json`) to its React component. This is the single
  wiring point between config and code.
- **Progress/stats**: stored client-side only, under the `dgh:*` localStorage
  key prefix (`lib/stats.ts`, `lib/storage.ts` — the Safari-private-mode-safe
  wrapper). One recorded result per game per UTC date. Nothing leaves the device.

### Adding a new game

1. Build the engine under `game-engines/<slug>/` (a `"use client"` component
   with no required props — read the daily seed itself via `lib/daily.ts`).
2. Register it in `lib/engine-registry.ts`.
3. Add an entry to `config/games.json` (slug, title, description, icon, color,
   path, engine key, category, priority, keywords, FAQ, tips, how-to-play).
4. Nothing else needs to change — routing, sitemap, category pages, and nav
   all derive from `config/games.json` automatically.

## Attribution

Several game engines are adapted from MIT-licensed open-source projects, with
full upstream attribution, pinned commit SHAs, and license text recorded in
[`NOTICE`](./NOTICE). Games without a `NOTICE` entry are original
implementations for this project.

## Deploying (Cloudflare Pages)

- Build command: `pnpm build`
- Build output directory: `out`
- Runtime: static assets only — no Node.js server, SSR routes, API routes, or database
- Set `NEXT_PUBLIC_SITE_URL` (see above) before the first production deploy
