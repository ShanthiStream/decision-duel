# Working notes

## Changelog

### 2026-10-02

- Scaffolded the repo (M1 start): manifests, CI, docs, AGENTS.md.
- M1 built: engine (6-card table, armor/poison/heal/recoil, reshuffle, telegraphed intents, 2 archetypes, 60-turn cap), features encoder (clone-and-simulate preview, facts only), agent (ported client/llm/teacher, card-greedy, oracle-6t, factory), turn-based sim runner (no clocks), headless + gen-data + probe scripts, event-driven browser (human click/keys 1-4, AI watch, capability-routed model dropdown). 34 tests green, typecheck clean.
- Headless smoke (seeds 100+, 2x for speed): greedy 4/8 wins (4/4 warden, 0/4 brute — brute is the hard matchup, watch in M2); oracle-6t 1/2 vs brute; tev1:0.8b 1/4, 0 failures, decision p50 ~0.5 s.
- Probe (4 tactical scenarios, balanced positions): tev1:0.8b 4/8 — pure position bias (always first option), the same near-chance story as pacman's probe. Distillation motivation confirmed; positions now balanced so bias scores 0.5.
- Fixed: runner recorded post-play turn on decision events (now the asked turn); probe scenarios had all-correct-at-1 (now 0,1,1,0).
- Dev server serves the page (5174, 200). `runs/` and `data/smoke` cleaned after verification.
