# Run models

Any model can duel — turns wait for answers, so latency never counts.

## Local decision models (Ollama /v1/systemone)

```bash
ollama pull tev1:0.8b
npm install
npm run dev            # http://localhost:5174/?model=tev1:0.8b
```

```bash
npm run headless -- --policy tev1:0.8b --games 20 --seed 100
```

## Plain chat models (llm: / llm-think:)

`llm:<ollama-model>` answers in constrained JSON (thinking off); `llm-think:<ollama-model>` allows thinking and reads the move from content or thinking trace. The dropdown lists installed models routed by capability.

## Baselines and labeling players

- `random`: uniform over playable cards.
- `greedy`: scripted heuristic over the same facts (the bar to beat).
- `oracle-*`: 1-ply search + greedy rollouts. Labels data, never a ladder player.
- `teacher*`: chat teacher over `TEACHER_BASE_URL` / `TEACHER_MODEL` in `.env`.

## Browser controls

Model (dropdown), side (player: AI/human per combatant), enemy archetype, seed, AI-vs-AI watch toggle. Same settings as URL params: `model`, `enemy`, `seed`.
