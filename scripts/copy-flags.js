#!/usr/bin/env node
// Copies the 4x3 country-flag SVGs needed by Daily Flag Quiz out of the
// flag-icons package (MIT, see NOTICE) into public/flags/<lowercase-code>.svg
// so they are served as plain static files by the static export.
// Only the ISO codes actually present in data/trivia/capitals.json are copied
// (60 of flag-icons' ~270), so the export doesn't carry 200+ unused flags.
// Files are always overwritten rather than skipped — the source of truth is the
// pinned flag-icons version in package.json, so a version bump should show up in
// public/ on the next build instead of leaving stale artwork behind.
// Run automatically via "prebuild" and "predev" npm scripts.
// Add new countries only to data/trivia/capitals.json — this script keeps
// public/flags/ in sync in both directions: it copies what the dataset needs
// and deletes any .svg left over from a code the dataset no longer contains,
// so a removed country can't keep shipping its flag in the static export.

const fs = require("fs");
const path = require("path");

const CAPITALS = path.join(__dirname, "../data/trivia/capitals.json");
const SRC = path.join(__dirname, "../node_modules/flag-icons/flags/4x3");
const DEST = path.join(__dirname, "../public/flags");

const entries = JSON.parse(fs.readFileSync(CAPITALS, "utf-8"));

// Fail loudly on a malformed row rather than dying inside .toLowerCase() with
// an unattributable TypeError.
const badRows = entries.filter((e) => typeof e?.code !== "string" || !/^[A-Za-z]{2}$/.test(e.code));
if (badRows.length > 0) {
  console.error(
    `[copy-flags] ${badRows.length} row(s) in data/trivia/capitals.json have a missing or malformed 2-letter "code": ${JSON.stringify(badRows.slice(0, 3))}`
  );
  process.exit(1);
}

// De-duplicate in case two rows ever share a code; keep source order.
const codes = [...new Set(entries.map((e) => e.code.toLowerCase()))];

fs.mkdirSync(DEST, { recursive: true });

const missing = [];
let copied = 0;
for (const code of codes) {
  const src = path.join(SRC, `${code}.svg`);
  if (!fs.existsSync(src)) {
    missing.push(code);
    continue;
  }
  fs.copyFileSync(src, path.join(DEST, `${code}.svg`));
  copied++;
}

// A missing flag would render as a broken image in the quiz, so fail the build
// rather than shipping a hole — most likely cause is a typo'd ISO code in
// capitals.json or a flag-icons rename.
if (missing.length > 0) {
  console.error(
    `[copy-flags] No 4x3 SVG in flag-icons for: ${missing.join(", ")} — check the ISO codes in data/trivia/capitals.json`
  );
  process.exit(1);
}

// Drop flags for codes the dataset dropped — otherwise a removed country keeps
// shipping its SVG in every export forever.
const wanted = new Set(codes.map((code) => `${code}.svg`));
const stale = fs
  .readdirSync(DEST)
  .filter((name) => name.endsWith(".svg") && !wanted.has(name));
for (const name of stale) fs.unlinkSync(path.join(DEST, name));

console.log(
  `[copy-flags] Synced ${copied} flag SVGs to public/flags/` +
    (stale.length > 0 ? ` (removed ${stale.length} stale: ${stale.join(", ")})` : "")
);
