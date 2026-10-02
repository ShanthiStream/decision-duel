import { describe, expect, it } from "vitest";
import { previewCard } from "../src/encoders/features.ts";
import { DEFAULT_ENCODER, ENCODERS } from "../src/encoders/index.ts";
import { optionToInput } from "../src/encoders/types.ts";
import { createDuel, playCard } from "../src/engine/duel.ts";

const BANNED = ["safe", "danger", "recommend", "best move", "should play", "play this", "good play", "bad play"];

interface StateShape {
  hand: string[];
  options: Record<string, { enemyHpAfter: number; playerHpAfter: number }>;
}

function encoded(seed: number) {
  const enc = ENCODERS.features.encode(createDuel(seed));
  return { enc, state: enc.state as StateShape };
}

describe("features encoder", () => {
  it("is the default and covers the hand", () => {
    expect(DEFAULT_ENCODER).toBe("features");
    const { enc, state } = encoded(3);
    expect(enc.keys).toEqual(["0", "1", "2", "3"]);
    expect(Object.keys(state.options)).toEqual(enc.keys);
    for (const k of enc.keys) expect(enc.criteria[k]!.toLowerCase()).toContain(state.hand[Number(k)]);
  });

  it("stays under a token budget and states facts, never verdicts", () => {
    const { enc } = encoded(3);
    const text = JSON.stringify(enc);
    expect(text.length).toBeLessThan(2000);
    const lower = text.toLowerCase();
    for (const word of BANNED) expect(lower).not.toContain(word);
  });

  it("matches the engine outcome for every option", () => {
    for (const seed of [3, 17, 99]) {
      const s = createDuel(seed);
      const enc = ENCODERS.features.encode(s);
      const state = enc.state as StateShape;
      for (const k of enc.keys) {
        const facts = state.options[k];
        const clone = structuredClone(s);
        playCard(clone, Number(k));
        expect(facts.enemyHpAfter).toBe(clone.enemy.hp);
        expect(facts.playerHpAfter).toBe(clone.player.hp);
      }
    }
  });

  it("splits card damage from the poison tick", () => {
    const s = createDuel(5);
    s.hand = ["wound", "strike", "strike", "strike"];
    s.deck = [];
    s.discard = [];
    s.enemy.hp = 30;
    s.enemy.armor = 0;
    s.enemy.poison = 1;
    const facts = previewCard(s, 0);
    // 4 through armor + (1 existing + 2 applied) tick.
    expect(facts.dmg).toBe(4);
    expect(facts.poisonTick).toBe(3);
    expect(facts.enemyHpAfter).toBe(30 - 4 - 3);
  });
});

describe("optionToInput", () => {
  it("maps keys to hand indices", () => {
    expect(optionToInput("0")).toBe(0);
    expect(optionToInput("3")).toBe(3);
    expect(() => optionToInput("back")).toThrow();
    expect(() => optionToInput("-1")).toThrow();
  });
});
