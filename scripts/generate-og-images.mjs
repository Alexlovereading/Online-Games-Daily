#!/usr/bin/env node
// Generates OG images (1200x630 PNG) for each game and the homepage.
// Uses @napi-rs/canvas — pure prebuilt Rust bindings, no system libs required.
// Run automatically via "predev" and "prebuild" npm scripts.
// Files already present in public/og/ are skipped (commit them to git).

import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DEST = join(ROOT, "public", "og");

mkdirSync(DEST, { recursive: true });

// Load games.json directly (no TypeScript)
const gamesData = JSON.parse(readFileSync(join(ROOT, "config", "games.json"), "utf-8"));

const W = 1200;
const H = 630;
const BG = "#1a1a14";
const TEXT_PRIMARY = "#e8e8e0";
const TEXT_SECONDARY = "#999990";
const SITE_NAME = "Online Games Daily";

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${r},${g},${b})`;
}

function drawBase(ctx, accentColor) {
  // Background
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  // Left accent bar
  const barW = 8;
  ctx.fillStyle = hexToRgb(accentColor);
  ctx.fillRect(0, 0, barW, H);

  // Subtle grid lines
  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  ctx.lineWidth = 1;
  for (let x = 60; x < W; x += 120) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  let currentY = y;
  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    const { width } = ctx.measureText(testLine);
    if (width > maxWidth && line) {
      ctx.fillText(line, x, currentY);
      line = word;
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, currentY);
  return currentY;
}

function drawIconBadge(ctx, label, accent) {
  const r = 52;
  const cx = 72 + r;
  const cy = 130;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = hexToRgb(accent);
  ctx.fill();
  ctx.fillStyle = BG;
  ctx.font = "bold 52px sans-serif";
  const text = label[0].toUpperCase();
  const m = ctx.measureText(text);
  ctx.fillText(text, cx - m.width / 2, cy + 18);
}

function generateGameImage(game) {
  const dest = join(DEST, `${game.slug}.png`);
  if (existsSync(dest)) {
    console.log(`[og] skip ${game.slug}.png (exists)`);
    return;
  }

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  const accent = game.color ?? "#58c46e";

  drawBase(ctx, accent);
  drawIconBadge(ctx, game.title, accent);

  // Game title
  ctx.fillStyle = TEXT_PRIMARY;
  ctx.font = "bold 72px sans-serif";
  wrapText(ctx, game.title, 72, 260, W - 144, 84);

  // Description
  ctx.fillStyle = TEXT_SECONDARY;
  ctx.font = "32px sans-serif";
  wrapText(ctx, game.description, 72, 380, W - 144, 44);

  // Site name footer
  ctx.fillStyle = hexToRgb(accent);
  ctx.font = "bold 28px sans-serif";
  ctx.fillText(SITE_NAME, 72, H - 48);

  ctx.fillStyle = TEXT_SECONDARY;
  ctx.font = "28px sans-serif";
  ctx.fillText("·  onlinegamesdaily.com", 72 + ctx.measureText(SITE_NAME).width + 16, H - 48);

  writeFileSync(dest, canvas.toBuffer("image/png"));
  console.log(`[og] generated ${game.slug}.png`);
}

function generateHomeImage() {
  const dest = join(DEST, "home.png");
  if (existsSync(dest)) {
    console.log("[og] skip home.png (exists)");
    return;
  }

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  const accent = "#d7ff58";

  drawBase(ctx, accent);

  // Colored dots row representing games
  const colors = gamesData.map((g) => g.color ?? "#58c46e");
  const dotR = 28;
  const dotY = 130;
  let dotX = 72 + dotR;
  for (const color of colors) {
    ctx.beginPath();
    ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2);
    ctx.fillStyle = hexToRgb(color);
    ctx.fill();
    dotX += dotR * 2 + 16;
  }

  // Headline
  ctx.fillStyle = TEXT_PRIMARY;
  ctx.font = "bold 80px sans-serif";
  ctx.fillText("Online Games Daily", 72, 260);

  // Tagline
  ctx.fillStyle = TEXT_SECONDARY;
  ctx.font = "36px sans-serif";
  wrapText(ctx, "Six free daily puzzles. One shared answer. No account required.", 72, 330, W - 144, 50);

  // Footer
  ctx.fillStyle = hexToRgb(accent);
  ctx.font = "bold 28px sans-serif";
  ctx.fillText("onlinegamesdaily.com", 72, H - 48);

  writeFileSync(dest, canvas.toBuffer("image/png"));
  console.log("[og] generated home.png");
}

function generateLogo() {
  // Raster brand logo for Organization.logo structured data — Google's Logo
  // guidance requires a raster format (PNG/JPG/GIF/WebP/ICO) at >=112x112px;
  // favicon.svg alone doesn't qualify. Matches the "O" badge used in
  // SiteFooter/SiteHeader: accent-color rounded square, dark ink glyph.
  const dest = join(ROOT, "public", "logo.png");
  if (existsSync(dest)) {
    console.log("[og] skip logo.png (exists)");
    return;
  }

  const SIZE = 512;
  const ACCENT = "#d7ff58";
  const INK = "#18211b";
  const RADIUS = 96;

  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext("2d");

  ctx.beginPath();
  ctx.moveTo(RADIUS, 0);
  ctx.arcTo(SIZE, 0, SIZE, SIZE, RADIUS);
  ctx.arcTo(SIZE, SIZE, 0, SIZE, RADIUS);
  ctx.arcTo(0, SIZE, 0, 0, RADIUS);
  ctx.arcTo(0, 0, SIZE, 0, RADIUS);
  ctx.closePath();
  ctx.fillStyle = ACCENT;
  ctx.fill();

  ctx.fillStyle = INK;
  ctx.font = "italic bold 320px serif";
  ctx.textBaseline = "middle";
  const label = "O";
  const m = ctx.measureText(label);
  ctx.fillText(label, (SIZE - m.width) / 2, SIZE / 2 + 16);

  writeFileSync(dest, canvas.toBuffer("image/png"));
  console.log("[og] generated logo.png");
}

generateLogo();
generateHomeImage();
for (const game of gamesData) {
  generateGameImage(game);
}

console.log("[og] OG image generation complete.");
