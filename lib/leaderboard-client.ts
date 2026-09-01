"use client";

import { containsBlockedTerm } from "./name-filter";
import { lsGet, lsSet } from "./storage";

const PLAYER_ID_KEY = "dgh:leaderboard:playerId";
const PLAYER_NAME_KEY = "dgh:leaderboard:playerName";
const ADJECTIVES = ["Swift", "Quiet", "Sharp", "Lucky", "Bold", "Calm", "Bright", "Quick"];
const NOUNS = ["Fox", "Otter", "Hawk", "Wren", "Lynx", "Puffin", "Heron", "Mole"];

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function randomName(): string {
  const a = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const n = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${a}${n}${Math.floor(Math.random() * 100)}`;
}

/** Anonymous per-device ID — no accounts, matches the rest of the site. */
export function getPlayerId(): string {
  let id = lsGet(PLAYER_ID_KEY);
  if (!id) {
    id = randomId();
    lsSet(PLAYER_ID_KEY, id);
  }
  return id;
}

export function getPlayerName(): string {
  let name = lsGet(PLAYER_NAME_KEY);
  if (!name) {
    name = randomName();
    lsSet(PLAYER_NAME_KEY, name);
  }
  return name;
}

/**
 * Returns false (and leaves the stored name unchanged) if `name` is empty
 * or matches the same blocklist the Worker enforces server-side — that's
 * the real gatekeeper for what appears on the public leaderboard, this is
 * just so the editor can give the player an immediate reason instead of
 * having their name silently swapped to "Anonymous" on next submit.
 */
export function setPlayerName(name: string): boolean {
  const trimmed = name.trim().slice(0, 24);
  if (!trimmed || containsBlockedTerm(trimmed)) return false;
  lsSet(PLAYER_NAME_KEY, trimmed);
  return true;
}

export type SubmitResult = {
  accepted: boolean;
  reason?: string;
  rank?: number | null;
  isPersonalBest?: boolean;
  savedValue?: number;
};

/** Dispatched on `window` after an accepted submission, so a mounted
 * <Leaderboard> for the same game can refetch instead of showing a stale
 * list until the player manually reloads or switches tabs. */
export const LEADERBOARD_SUBMITTED_EVENT = "dgh:leaderboard-submitted";

export type LeaderboardSubmittedDetail = { slug: string; dateKey: string };

export async function submitLeaderboardScore(
  slug: string,
  dateKey: string,
  value: number,
): Promise<SubmitResult> {
  try {
    const res = await fetch("/api/leaderboard/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        slug,
        dateKey,
        playerId: getPlayerId(),
        playerName: getPlayerName(),
        value,
      }),
    });
    const result = (await res.json()) as SubmitResult;
    if (result.accepted) {
      window.dispatchEvent(
        new CustomEvent<LeaderboardSubmittedDetail>(LEADERBOARD_SUBMITTED_EVENT, {
          detail: { slug, dateKey },
        }),
      );
    }
    return result;
  } catch {
    // Network failure shouldn't break the game — the local result is
    // already saved via lib/stats.ts regardless of leaderboard submission.
    return { accepted: false, reason: "network_error" };
  }
}

export type LeaderboardEntry = {
  rank: number;
  playerName: string;
  value: number;
  submittedAt?: number;
};

export type LeaderboardResponse = {
  slug: string;
  direction: "higher_is_better" | "lower_is_better";
  entries: LeaderboardEntry[];
};

export async function fetchDailyLeaderboard(
  slug: string,
  dateKey: string,
  limit = 20,
): Promise<LeaderboardResponse | null> {
  try {
    const res = await fetch(
      `/api/leaderboard/${encodeURIComponent(slug)}/daily?date=${dateKey}&limit=${limit}`,
    );
    if (!res.ok) return null;
    return (await res.json()) as LeaderboardResponse;
  } catch {
    return null;
  }
}

export async function fetchAllTimeLeaderboard(
  slug: string,
  limit = 20,
): Promise<LeaderboardResponse | null> {
  try {
    const res = await fetch(`/api/leaderboard/${encodeURIComponent(slug)}/alltime?limit=${limit}`);
    if (!res.ok) return null;
    return (await res.json()) as LeaderboardResponse;
  } catch {
    return null;
  }
}
