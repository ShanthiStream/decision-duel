# AGENTS.md

Turn-based card battler where a local decision model (`/v1/systemone`, default `tev1:0.8b` on Ollama) duels a scripted enemy, one card per turn. Sister project of decision-pacman: same agent stack and pipeline discipline, no realtime machinery (turn-based, so no clocks, no stale rate, no `?wait=1`). Read `docs/prd.md` and `docs/rfc.md` before changing architecture. Public GitHub repo, English only.

## Commands

- `npm install`, `npm run dev` (http://localhost:5174), `npm run typecheck`, `npm test`, `npm run build` (`tsc --noEmit` + vite build).
- CI runs `npm ci` → `typecheck` → `test`; keep that order locally.
- Single test: `npx vitest run tests/<name>.test.ts`.
- Ladder eval (eval seeds 100+, no time cap — duels end by win/lose/turn-cap): `npm run headless -- --policy <name> --games 20 --seed 100`.
- Probes are stdlib-only, no venv: `python3 scripts/probe_decision_models.py <model>`.

## Structure

- `src/engine/`: pure deterministic duel logic (`createDuel`, `playCard`). No DOM, timers, network, or `Math.random` (seeded RNG only). `cards.ts` is a data table — balance patches touch it, never logic. `src/sim/runner.ts` drives headless duels on the same engine.
- `src/encoders/`: state-to-text, facts never verdicts (no good/bad/play-this — RFC 3). `features` is the comparison input.
- `src/agent/`: `/v1/systemone` client (ported from decision-pacman), `llm:<model>` / `llm-think:<model>` chat policies, `teacher*` labelers, `oracle.ts` 1-ply search + greedy rollouts (labels only, never a compared player).
- `src/render/`, `src/main.ts`: event-driven table UI (no rAF loop). Read engine state, never mutate rules. Original code-drawn art only.
- `scripts/`: command contract (`run_headless.ts`, `gen_teacher_data.ts`, probes). Don't leave commands only in the README.
- `training/`: fine-tune/export/score scripts (M3). `training/prompt.py` must stay byte-identical to Ollama's serving prompt.
- `docs/`: `rfc.md` (update when a decision changes), `results.md` (update on headline-number change), `model_evaluation.md` (new section per result), `test.md` (what counts as verified), `guides/` (update when a command/flag changes), `working.md` (changelog + measured numbers with model, encoder, hardware — update every session).

## Rules

- Turn-based: the game always waits for the answer. Latency is informational, never charged. No clocks, no stale answers.
- Seeds are disjoint and eval seeds never train: eval 100–199, val 900–999, train 1000+. `gen-data` refuses eval seeds.
- Lookahead (oracle rollouts) may label training data but never enters a player's input in a comparison. Fixed 12-card deck for M1–M4; no deckbuilding (explicit M5+ scope).
- Secrets hygiene: no emails, keys, paths, hostnames, vault refs in tracked files; `.env.example` placeholders only. Privacy scan before any push: `rg -n -i "@|op://|/Users/|ts\.net|tailscale|api[_-]?key|token" .`, review every hit.
- Default branch `master` is protected (PRs only). Commit/push/PR only when explicitly asked; keep commits small.
