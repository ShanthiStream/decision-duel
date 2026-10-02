# Evaluate

Ladder: 20 duels per policy on seeds 100–119, against each enemy archetype, `features` input, no lookahead.

```bash
npm run headless -- --policy <name> --games 20 --seed 100
```

Duel `i` uses seed `seed + i`. The runner writes `runs/<tag>/decisions.jsonl` (one record per turn) and `summary.json`, and prints win rate, mean turns, mean HP left, and decision p50.

## Seeds

Disjoint ranges: eval 100–199, val 900–999, train 1000+. `gen-data` refuses eval seeds. Same policy + seed = identical duel.

## The lookahead rule

Oracle rollouts may label training data but never enter a player's input in a comparison. Players are compared on `features` only.

## Recording results

Log measurements in `working.md` (model, encoder, hardware). In-duel results get a section in `model_evaluation.md`; headline changes update `results.md`.
