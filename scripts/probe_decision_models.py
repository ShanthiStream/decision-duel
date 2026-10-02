#!/usr/bin/env python3
"""Probe a decision model on tactical duel scenarios with known-correct cards.

Uses only the standard library:

  python3 scripts/probe_decision_models.py tev1:0.8b
  python3 scripts/probe_decision_models.py tev1:0.8b --base-url http://localhost:11435

Each scenario varies its numbers per round so no two requests repeat exactly
(repeated requests hit a server cache and report 5-10x lower latency).
"""
import argparse
import json
import time
import urllib.request

INSTRUCTIONS = (
    "You play one card per turn against the enemy. Armor absorbs damage, then expires "
    "at the start of that side's next turn. You win by reducing the enemy to 0 HP. "
    "Reply with the hand index to play."
)


def state(player_hp, enemy_hp, intent, hand, deck_left=6):
    options = {str(i): {"card": c} for i, c in enumerate(hand)}
    return {
        "turn": 5,
        "player": {"hp": player_hp, "maxHp": 40},
        "enemy": {"hp": enemy_hp, "maxHp": 40, "armor": 0, "poison": 0,
                  "intent": intent, "archetype": "brute"},
        "hand": hand,
        "deckLeft": deck_left,
        "discardLeft": 2,
        "options": options,
    }


def criteria(hand):
    desc = {
        "strike": "Strike: 6 dmg", "heavy": "Heavy: 10 dmg, self 2",
        "block": "Block: +6 armor", "wound": "Wound: 4 dmg, +2 poison",
        "brace": "Brace: 3 dmg, +3 armor", "rally": "Rally: heal 4",
    }
    return {str(i): desc[c] for i, c in enumerate(hand)}


def scenarios(j):
    """(name, state, criteria, expected_key). Numbers shift with j to stay fresh,
    and correct positions vary (0, 1, 1, 0) so a fixed-position bias scores 0.5."""
    return [
        ("lethal",
         state(30, 5 + (j % 2), "attack 8", ["strike", "block"]), None, "0"),
        ("survive",
         state(8 - (j % 3), 30, "attack 12", ["strike", "block"]), None, "1"),
        ("press",
         state(40, 25 + j, "defend 8", ["rally", "heavy"]), None, "1"),
        ("no-suicide",
         state(2, 20, "attack 6", ["strike", "heavy"]), None, "0"),
    ]


def ask(base_url, model, st, crit, timeout):
    body = json.dumps({
        "model": model,
        "keep_alive": -1,
        "state": st,
        "questions": {"move": {"type": "choice", "instructions": INSTRUCTIONS, "criteria": crit}},
    }).encode()
    req = urllib.request.Request(base_url.rstrip("/") + "/v1/systemone", data=body,
                                 headers={"Content-Type": "application/json"})
    t0 = time.monotonic()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            out = json.loads(res.read())
    except Exception as e:  # noqa: BLE001 - report and continue
        return None, 0, 0, f"error: {e}"
    ms = (time.monotonic() - t0) * 1000
    try:
        move = out["answers"]["move"]
        return move["choice"], ms, out.get("usage", {}).get("input_tokens", 0), ""
    except KeyError:
        return None, ms, 0, f"bad schema: {json.dumps(out)[:200]}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("model")
    ap.add_argument("--base-url", default="http://localhost:11434")
    ap.add_argument("--rounds", type=int, default=2)
    ap.add_argument("--timeout", type=int, default=60)
    a = ap.parse_args()

    asked = correct = 0
    lat, tokens = [], []
    for r in range(a.rounds):
        for name, st, _, expected in scenarios(r):
            crit = criteria(st["hand"])
            choice, ms, tok, err = ask(a.base_url, a.model, st, crit, a.timeout)
            asked += 1
            mark = "?"
            if err:
                mark = f"FAIL {err}"
            else:
                lat.append(ms)
                tokens.append(tok)
                mark = "ok" if choice == expected else f"WRONG (chose {choice}, want {expected})"
                correct += choice == expected
            print(f"[{name} r{r}] {mark} ({ms:.0f} ms)")
    lat.sort()
    p50 = lat[len(lat) // 2] if lat else 0
    print(json.dumps({"model": a.model, "accuracy": correct / max(1, asked),
                      "correct": correct, "asked": asked,
                      "latency_p50_ms": round(p50),
                      "input_tokens_p50": sorted(tokens)[len(tokens) // 2] if tokens else 0}))


if __name__ == "__main__":
    main()
