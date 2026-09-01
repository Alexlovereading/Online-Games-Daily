#!/usr/bin/env node
// Copies daily word-groups puzzle JSON files from data/word-groups/ into
// public/data/word-groups/ so they are served at runtime by the static export.
// Also writes data/word-groups-manifest.json — a sorted list of available
// dates, statically imported by WordGroupsGame.tsx so "Play Again" can pick a
// random already-authored puzzle without a directory listing at runtime.
// Run automatically via "prebuild" and "predev" npm scripts.
// Add new puzzle files only to data/word-groups/ — this script keeps public/
// and the manifest in sync.

const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "../data/word-groups");
const DEST = path.join(__dirname, "../public/data/word-groups");
const MANIFEST = path.join(__dirname, "../data/word-groups-manifest.json");

fs.mkdirSync(DEST, { recursive: true });

const files = fs.readdirSync(SRC).filter((f) => f.endsWith(".json"));
for (const file of files) {
  fs.copyFileSync(path.join(SRC, file), path.join(DEST, file));
}

const dates = files.map((f) => f.replace(/\.json$/, "")).sort();
fs.writeFileSync(MANIFEST, JSON.stringify({ dates }, null, 2) + "\n");

console.log(`[copy-word-groups] Synced ${files.length} puzzle files to public/data/word-groups/`);
console.log(`[copy-word-groups] Wrote manifest with ${dates.length} dates to data/word-groups-manifest.json`);
