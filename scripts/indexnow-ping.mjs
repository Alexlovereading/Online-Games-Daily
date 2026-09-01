#!/usr/bin/env node
// Pings the IndexNow API (Bing/Yandex/Naver/Seznam) so URLs with changed
// content get recrawled faster than waiting for the next natural crawl.
// Not run automatically by predev/prebuild — this project has no deploy
// pipeline to trigger it, so run it by hand after a production deploy:
//   node scripts/indexnow-ping.mjs
// Key file lives at public/<key>.txt and must match INDEXNOW_KEY below.

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://onlinegamesdaily.com";
const INDEXNOW_KEY = "477f8c947c074b58b6442b4b5fd860a0";

const gamesData = JSON.parse(readFileSync(join(ROOT, "config", "games.json"), "utf-8"));

const urlList = [
  SITE_URL,
  `${SITE_URL}/about`,
  `${SITE_URL}/privacy`,
  `${SITE_URL}/licenses`,
  ...gamesData
    .filter((g) => g.status === "live")
    .map((g) => `${SITE_URL}${g.path}`),
  ...[...new Set(gamesData.map((g) => g.category))].map((c) => `${SITE_URL}/category/${c}`),
];

const payload = {
  host: new URL(SITE_URL).host,
  key: INDEXNOW_KEY,
  keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
  urlList,
};

const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify(payload),
});

console.log(`[indexnow] submitted ${urlList.length} URLs — status ${res.status}`);
if (!res.ok) {
  console.error(await res.text());
  process.exitCode = 1;
}
