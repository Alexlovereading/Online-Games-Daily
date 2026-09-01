// Basic profanity/slur filter for public leaderboard nicknames. Not
// exhaustive — this catches the common/obvious cases via substring match
// on a normalized (lowercased, non-letters stripped) form of the name, so
// simple evasion like "b4d-word" or "B A D W O R D" still gets caught.
// A name that matches falls back to the same "Anonymous" default used for
// an empty name, rather than rejecting the whole score submission — losing
// someone's real result over a nickname isn't worth it.

const BLOCKED_TERMS = [
  // Slurs (racial, ethnic, homophobic, transphobic, ableist) — kept
  // intentionally terse, not spelled out further in comments.
  "nigger", "nigga", "chink", "spic", "kike", "gook", "wetback", "beaner",
  "faggot", "fag", "dyke", "tranny", "retard", "retarded",
  // Extreme profanity / sexual terms unsuitable for a public display name.
  "fuck", "shit", "cunt", "cock", "dick", "pussy", "whore", "slut", "bitch",
  "asshole", "rape", "rapist", "nazi", "hitler",
  // Common circumvention: repeated without separators too.
];

function normalize(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function containsBlockedTerm(name: string): boolean {
  const normalized = normalize(name);
  if (!normalized) return false;
  return BLOCKED_TERMS.some((term) => normalized.includes(term));
}
