---
name: site-seo-geo
description: Do a keyword-driven SEO/GEO content pass on one game's page in this Daily Games Hub project — picks high/mid-priority target keywords from the project's Semrush-style keyword workbook, but only the ones actually relevant to what the game does (drops keywords that would need padding "we don't support this" filler to justify), writes the content in a first-person, data-grounded, non-redundant voice pulled from the real engine code instead of generic AI-sounding FAQ copy, and verifies the rendered page + JSON-LD in the browser. Use this whenever the user asks to "optimize SEO" or "do GEO" for a specific game page, asks to add/refresh keywords or FAQ content for a game, references the "22款游戏关键词.xlsx" (or similar) keyword spreadsheet in connection with a game page, or asks to repeat the SEO work already done on other games for a new or updated one.
---

# Site SEO/GEO content pass

This project (Daily Games Hub — static Next.js export, no backend) drives per-game SEO/GEO
content entirely from `config/games.json`. There is no per-page copywriting; every game's
`description`, `keywords[]`, `tips[]`, `faq[]`, and `howToPlay[]` fields flow straight into
the rendered page **and** into JSON-LD structured data via a shared template
(`app/[slug]/page.tsx`, `components/GameLayout.tsx`, `components/SeoBlocks.tsx`). So "optimize
the Sudoku page" reduces to "edit the `daily-sudoku` object in games.json well" — there's no
separate template to touch per game.

Work through these steps for the game the user names.

## 1. Find the game's candidate keywords

The keyword source is an xlsx (ask the user for the path if not given — it's usually on their
Desktop, named something like `22款游戏关键词.xlsx`). Its `SEO关键词推荐` sheet has one row per
keyword, grouped into merged blocks per game, with columns: game name (en/cn), seed term,
recommended keyword, monthly volume, KD (difficulty 0-100), CPC, search intent, priority
(高/中/低), and a Chinese note on the opportunity.

Use the bundled script rather than re-deriving the block-grouping logic by hand:

```bash
python3 .claude/skills/site-seo-geo/scripts/extract_keywords.py <xlsx-path> --list
python3 .claude/skills/site-seo-geo/scripts/extract_keywords.py <xlsx-path> "<Game Name>"
```

The script already drops `优先级 == 低` rows and reports how many it dropped — **this project's
established rule is 高/中 only**, low-priority terms aren't worth the content real estate. Don't
pass `--include-low` unless the user explicitly asks to reconsider that rule.

## 2. Read the game's actual engine code before writing a word

This is the step that's easy to skip and the one that matters most. `config/games.json` content
gets rendered as an FAQPage JSON-LD block that AI answer engines (the "GEO" half of this task)
will quote directly as fact. If the FAQ claims a feature that isn't in the code, you're not doing
SEO, you're publishing a bug that erodes trust with both users and answer engines the moment
someone tests it.

Find the engine folder via `lib/engine-registry.ts`, not by guessing — the `engine` field in
games.json is a registry key, and it doesn't always match the folder name (`capital-quiz` lives in
`game-engines/trivia/`, `snake-game` lives in `game-engines/snake/`). Read the component + any core
logic file end to end. While you're
there, **re-check every existing FAQ/tip claim against the code too**, not just the new content
you're about to add — this pass caught two stale claims in the Sudoku FAQ (a "pencil-mark mode"
and an "undo control") that had never actually been implemented. Fix what you find; don't leave
known-false claims sitting next to the new honest ones.

## 3. Relevance gate — high search volume alone doesn't earn a spot

The keyword sheet ranks opportunity, not fit. Before writing anything for a keyword, ask: *does
this describe something the game actually is, or actually does?* Two outcomes:

- **Yes, directly** (e.g. "sudoku x wing" — the grid genuinely is a standard 9x9 board every
  classic technique applies to; "color sudoku" — the board genuinely does highlight cells in
  color, even if not as a named variant) → write about it.
- **No, and there's nothing real to redirect to** (e.g. "samurai sudoku" / "jigsaw sudoku" /
  "16x16 sudoku" when the engine only ever generates a classic 9x9 grid, or a competitor's brand
  name like "sudoku 247") → **drop the keyword. Don't write a "we don't support this" FAQ entry
  to capture the search volume anyway.**

That second case is the one worth resisting, because it's tempting — the keyword has real volume,
and a "not supported yet" answer is technically honest. But stacking up several FAQ entries that
each exist only to say "no, we don't have that" isn't useful content for anyone who lands on the
page; it's keyword coverage for its own sake, and it's exactly the kind of padding that makes a
page read as machine-generated rather than written by someone who actually built the thing. A
real question deserves a real page, not a disclaimer bolted onto an unrelated one. If the user
specifically wants that competitor-interception or variant-coverage content anyway, that's a
legitimate call for them to make — surface the tradeoff and let them decide, rather than defaulting
to including it.

Rule of thumb: if the honest answer to "do you have this" would require the word "not" and offers
nothing positive in return, it's a sign the keyword isn't actually about this game — skip it.

## 4. Write like the person who built this, not like a keyword machine

This is where a technically-correct SEO pass can still fail the actual goal, and it's easy to miss
because nothing about it throws an error. Generic FAQ-speak — hedged qualifiers ("far more",
"a genuine challenge"), corporate "we/our", answers that restate the question before answering it —
reads as machine-generated even when every fact in it is true. Search engines' helpful-content
systems and AI answer engines (the GEO half of this skill) both weigh authenticity signals, and a
human visitor trusts a specific, first-person answer more than a polished generic one anyway. Three
concrete habits fix most of it:

- **Pull real numbers out of the code, not vague qualifiers.** "Easy is generated with far more
  starting clues" is a guess dressed up as a fact. `game-engines/sudoku/sudoku-core.ts` literally
  defines `Easy: 36, Medium: 30, Hard: 24` — use those numbers. If the code has a fallback,
  a cap, a seed, a specific count, a specific formula — anything concrete — that's better content
  than any adjective. This also means you'll sometimes find a genuinely interesting real detail
  worth surfacing, not just a number: the Sudoku pass turned up that Hard puzzles silently fall
  back to Medium if unique-solution generation takes too long, which became its own honest,
  specific FAQ answer instead of a generic difficulty description.
- **Write as the person who built it, first person.** "Our hardest built-in setting is labeled
  Hard, generated with fewer starting clues for a tougher solve. We don't currently offer..." vs.
  "Not under that name — Hard is as far as the built-in levels go, and it's generated with just 24
  starting numbers, which is genuinely tough." Same fact, but the second one sounds like someone
  who actually knows the code talking, not a template. Use "I" (or "I'd" / "I built" / "I lean
  on") — this is a small, indie-feeling site, and that voice fits it better than corporate "we".
- **One fact lives in exactly one place.** If a tip and an FAQ answer would explain the same
  mechanic, that's redundancy, not reinforcement — pick the one place it belongs and have the
  other either skip it or reference it briefly ("see the color question above") instead of
  re-explaining it. Before finalizing, skim the new tips/FAQ together and cut anything that's
  saying the same thing twice in different words. Every FAQ entry and every tip should resolve one
  specific, distinct question — if you can't say in one phrase what question it uniquely answers,
  cut it.

## 5. Where content actually lands on the page

Map keyword-bearing content to the `GameConfig` fields, and place different keyword groups in
different fields rather than stuffing them all into one — the user wants keywords spread across
the page's actual positions, and each field renders somewhere distinct:

| Field | Renders as | Notes |
|---|---|---|
| `description` | `<meta description>` + H1 subtitle | Keep it one honest sentence; don't keyword-stuff it, it's the first thing a human and a search snippet both show. |
| `keywords[]` | `<meta keywords>` | Low ranking weight today but still worth populating cleanly — also doubles as your own checklist of what you've covered. |
| `tips[]` | "Tips & Strategy" H2 list | Good home for technique-specific keywords (e.g. a solving-technique term) framed as genuine advice, not a keyword drop. |
| `faq[]` | "FAQ" H2 list **and** `FAQPage` JSON-LD | The main workhorse — most keyword intents (variant names, comparisons, feature questions) belong here as a real question a user would type. |
| `howToPlay[]` | "How to Play" H2 list | Procedural only — resist the urge to put keywords here, unnatural phrasing here reads as spam since it's the shortest, most literal section. |

Don't add new schema fields or touch the shared components (`GameLayout.tsx`, `SeoBlocks.tsx`,
`app/[slug]/page.tsx`) to make room for more content — the whole point of this architecture is
that every game uses the same template, and adding a one-off section for a single game breaks
that consistency for no real gain. If the existing fields genuinely can't hold what's needed, say
so to the user before changing shared code.

## 6. Edit `config/games.json`

Find the game's block (`grep -n '"slug": "<slug>"' config/games.json`) and edit in place with the
`Edit` tool. Keep the JSON valid — validate after editing:

```bash
python3 -c "import json; json.load(open('config/games.json')); print('valid json')"
```

## 7. Verify

Run the project's existing checks, then look at the actual rendered page:

```bash
npx vitest run tests/games.test.ts
npx tsc --noEmit
```

Then use the browser preview tools: start the `dev` launch config, navigate to the game's
`path`, and confirm the new content actually appears — `get_page_text` for the visible FAQ/tips
copy, and a small `javascript_tool` snippet to pull `document.querySelector('meta[name="keywords"]')`
and the `FAQPage` `<script type="application/ld+json">` block's `mainEntity.length`, so you're
confirming the structured data picked up the new Q&As too, not just the visible text. Stop the
preview server when done.

## 8. Report back

Summarize for the user: which keywords were targeted and where each landed (field + why), which
were deliberately excluded and why (low priority, or passed the volume screen but failed the
relevance gate in step 3), and anything you fixed that was already wrong on the page.
