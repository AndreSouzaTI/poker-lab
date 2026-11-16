# Contributing to Poker Lab

Thanks for wanting to help! Suggestions, bug reports and pull requests are all welcome — in English or Portuguese.

## Suggest something or report a bug

Open an issue using one of the templates: <https://github.com/AndreSouzaTI/poker-lab/issues/new/choose>

For coach or poker-logic issues, please include the situation: your cards, the board, your position and what the coach said.

## Send a pull request

1. Fork and clone the repo.
2. Open `index.html` in your browser — there is no build step.
3. Make your change. Keep it dependency-free (plain HTML, CSS and JavaScript).
4. If you touch `js/engine.js`, add or update a test in `tests/` and run `npm test` (Node 18+).
5. Open the PR describing what changed and why.

## Project layout

```
index.html         page markup
css/styles.css     styles
js/engine.js       pure poker logic (no DOM) — also loaded by the tests
js/audio.js        Web Audio sound effects
js/ai.js           pro-style AI, range reading, opponent profiles and coach styles
js/tournament.js   tournament structure, background tables, balancing and payouts
js/game.js         table state, betting, classic bots, coach and UI
tests/             node:test unit tests for the engine
```
