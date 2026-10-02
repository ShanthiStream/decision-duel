# Test strategy

## Unit tests (Vitest, offline, default `npm test`)

- Engine: each card's effect (damage, armor absorb + expiry, poison tick + decay, heal cap, heavy self-damage), reshuffle when the deck empties, intent-cycle advance, win/lose/cap endings.
- Determinism: same seed + card sequence = identical state.
- Encoders: snapshots for fixed states, options match the hand, size under token budget (char count proxy), no verdict fields.
- Agent: oracle picks lethal when available; teacher parsing (illegal/unparseable drops the state, never guesses); llm move extraction incl. thinking traces.
- Runner: a scripted policy finishes a duel; labeler answers recorded alongside played ones.

## Integration tests (opt-in, need Ollama)

- `python3 scripts/probe_decision_models.py <model>`: tactical scenarios with known-correct cards. Record in `working.md` when models/encoders/hardware change.

## Headless evaluation (manual, needs Ollama)

`npm run headless -- --policy tev1:0.8b --games 20 --seed 100` plays seeded duels, JSONL under `runs/` (gitignored). An encoder/agent change is done when its win rate is compared against the previous run and `random`/`greedy` on the same seeds, written to `working.md`. Full protocol: `docs/guides/evaluate.md`.

## Manual browser check

With `npm run dev` + Ollama: human clicks a card, enemy answers on intent, AI-vs-AI watch mode advances, probability display updates, stopping Ollama shows the error panel while the duel state stays intact.
