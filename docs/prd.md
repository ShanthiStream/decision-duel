# PRD: Decision Duel

## Goal

A turn-based card battler driven by a local decision model, built to repeat decision-pacman's pipeline (baselines → teacher labels → distilled 0.8B → ladder) in a domain with no spatial reasoning: discrete card choices from compact combat facts.

## Requirements (M1: playable duel)

1. **Duel.** Player vs. one scripted enemy, one card per turn from a hand of 4, fixed 12-card deck, redraw after every turn (reshuffle discard when empty). 40 HP each, 60-turn cap (cap = loss for ladder purposes).
2. **Cards (data table, 6 cards).** Strike (6 dmg), Heavy (10 dmg, self 2), Block (6 armor), Wound (4 dmg + 2 poison), Brace (3 armor + 3 dmg), Rally (heal 4, capped at max HP). Deck: 4/2/2/2/1/1.
3. **Telegraphed enemy.** The enemy's next action is visible before the player chooses (attack N / defend N). Two archetypes: Brute (attack-heavy cycle) and Warden (defend-heavy cycle). Pattern start offset from seed.
4. **Real-time-free play.** Turn-based: the game always waits for the answer. Any `/v1/systemone` decision model, any `llm:`/`llm-think:` chat model, scripted `random`/`greedy`, and a human (click a card) can play either side in the browser.
5. **Headless eval.** Seeded duels from the command line with JSONL decision logs and a summary (wins, turns, HP left, latency). Same engine as the browser.
6. **Stack.** Vite + TypeScript, Vitest, `tsx` scripts. No UI framework. No original card art; code-drawn UI.

## Non-goals (M1–M4)

Deckbuilding/draft, multiple enemies, relics/statuses beyond armor + poison, animations beyond card play feedback, audio, iPhone app (M4).

## Success criteria

- M1: full duels complete headless and human-vs-`tev1:0.8b` is watchable in the browser.
- M2: 20-game ladder per policy on eval seeds with win rates in `docs/results.md`, no dominant-strategy collapse.
- M3: distilled 0.8B beats `tev1:4b` win rate.
- M4: static site deployed; iOS app plays on device.
