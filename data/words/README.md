# Daily word data provenance

`answers.ts` and `allowed-guesses.ts` were independently selected for this project from ordinary English vocabulary. They were not copied from a game, commercial puzzle feed, dictionary repository, or the upstream `lynn/hello` word lists.

- Scope: lowercase five-letter ASCII words only
- Answers: familiar, non-offensive words suitable for a broad daily puzzle audience
- Allowed guesses: a finite set of common words, including every answer
- Maintenance: additions require the same length, uniqueness, and answer-subset tests used by `tests/word-game.test.ts`

The upstream `lynn/hello` files `dictionary.json` and `targets.json` are intentionally not included.
