# RFC: Architecture and key decisions

## Summary

A deterministic TypeScript duel engine (`createDuel`, `playCard`) with no time dimension: each turn the player plays one card, the enemy answers on its telegraphed intent, and the hand refills. An agent encodes the combat state as compact JSON (`features`) and queries a decision endpoint — local decision models over `/v1/systemone`, plain chat models via `llm:`/`llm-think:`, or scripted baselines. The browser is event-driven (no frame loop): human clicks or an async AI-vs-AI watch mode. The same engine runs headless for evals and teacher-data generation.

## Components

- `src/engine/`: `types.ts` (DuelState, cards, intents), `cards.ts` (the 6-card data table — balance lives here), `duel.ts` (create/play/turn logic over plain data, seeded RNG), `rng.ts` (mulberry32 on the state).
- `src/encoders/`: `features` (per-card aftermath facts + global combat facts; never verdicts — decision 3), `types.ts` (`EncodedDecision`, `optionToInput`).
- `src/agent/`: `client.ts` (`/v1/systemone`), `llm.ts` (`llm:` strict / `llm-think:` tolerant, capability routing for the picker), `policies.ts` (random, greedy over card facts, systemOne), `factory.ts` (policy names), `oracle.ts` (1-ply search + greedy rollout; labels only), `teacher.ts` (chat teacher, peek = rollout futures).
- `src/sim/runner.ts`: turn loop shared by eval and data generation (labeler + alsoEncode support; no clocks).
- `src/render/table.ts`, `src/main.ts`: code-drawn table, HP bars, intents, probability display. Read engine state, never mutate rules.
- `scripts/`: `run_headless.ts`, `gen_teacher_data.ts`, `probe_decision_models.py`.
- `training/` (M3): build/train/export/score with Ollama prompt parity.

## Key decisions

### 1. One card per turn, fixed deck

Options stay ≤ 4 and state stays tiny. Energy systems (play any subset) explode the option space and are out of scope until M5+.

### 2. Turn-based: no clocks, latency never charged

The game waits for every answer. Slow models are judged on choices, so cloud/thinking models play without handicap. Latency is logged, not gamed.

### 3. Encoders report facts, never verdicts

Per-card numeric aftermath (damage, block gained, HP after, poison applied, self-damage, heal) plus global facts (HP/armor both sides, enemy intent, turn, deck counts). Never "good", "safe", or "play this" — a fine-tuned model must learn judgment, not copy labels.

### 4. Telegraphed intents + two enemy archetypes

Intents make decisions learnable from current-state facts alone. Two archetypes (Brute, Warden) guard against balance collapse: if one policy wins only one matchup, the ladder shows it.

### 5. Same policy surface as decision-pacman

Bare decision-model names, `random`, `greedy`, `llm:<model>`, `llm-think:<model>`, `teacher*`, `oracle-*`. The model picker routes installed Ollama models by capability. Anything learned about adapters there ports here.
