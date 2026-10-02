# Decision Duel

A turn-based card battler where a local decision model plays one card per turn against a scripted enemy, through Ollama's `/v1/systemone` API. The repository compares off-the-shelf models (Tev decision models and plain chat models answering in constrained JSON) on seeded duels, with a distillation pipeline (teacher labels → 0.8B LoRA → ladder eval) planned for milestone 3.

## Quickstart

Requirements: Node 20+, Ollama 0.35+.

```bash
ollama pull tev1:0.8b
npm install
npm run dev            # open http://localhost:5174
```

Switch models in the side panel, or pass `?model=tev1:4b`. Because duels are turn-based, any model can play — including thinking and cloud models via `llm-think:<model>` — with no latency penalty.

## Headless eval

```bash
npm run headless -- --policy tev1:0.8b --games 20 --seed 100
```

Protocol, seeds, and guides are in `docs/` (see `docs/guides/evaluate.md`). Current numbers live in `docs/results.md`.

## Tests

```bash
npm test
```

## License

MIT. Original code-drawn art only.
