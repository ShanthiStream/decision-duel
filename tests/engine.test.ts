import { describe, expect, it } from "vitest";
import { createDuel, currentIntent, enemyLabel, playCard } from "../src/engine/duel.ts";
import type { CardId } from "../src/engine/types.ts";

function rigged(hand: CardId[], seed = 1) {
  const s = createDuel(seed);
  s.deck = [];
  s.discard = [];
  s.hand = [...hand];
  return s;
}

describe("createDuel", () => {
  it("deals a hand of 4 from the 12-card deck", () => {
    const s = createDuel(7);
    expect(s.hand).toHaveLength(4);
    expect(s.deck).toHaveLength(8);
    expect(s.phase).toBe("playing");
    expect(s.player.hp).toBe(40);
  });

  it("varies the enemy opening by seed", () => {
    const openings = new Set([0, 1, 2, 3, 4, 5].map((seed) => JSON.stringify(currentIntent(createDuel(seed)))));
    expect(openings.size).toBeGreaterThan(1);
  });

  it("is deterministic for the same seed", () => {
    expect(JSON.stringify(createDuel(42))).toBe(JSON.stringify(createDuel(42)));
  });

  it("labels enemies", () => {
    expect(enemyLabel("brute")).toBe("Brute");
    expect(enemyLabel("warden")).toBe("Warden");
  });
});

describe("playCard", () => {
  it("strike damages the enemy through armor", () => {
    const s = rigged(["strike"]);
    s.enemy.armor = 4;
    playCard(s, 0);
    // 6 - 4 absorbed = 2 through; leftover enemy armor expires on its turn.
    expect(s.enemy.hp).toBe(38);
  });

  it("block absorbs the attack, then expires", () => {
    const s = rigged(["block", "strike"]);
    // Force a known attack intent: brute pattern starts vary by seed; find an attack turn.
    s.enemy.intentIndex = 0; // brute: attack 8
    s.enemy.archetype = "brute";
    playCard(s, 0);
    expect(s.player.hp).toBe(40 - (8 - 6));
    // Next turn the old armor is gone.
    const hpBefore = s.player.hp;
    s.hand = ["strike"];
    s.deck = [];
    s.discard = [];
    playCard(s, 0);
    expect(s.player.hp).toBeLessThan(hpBefore);
  });

  it("heavy deals recoil directly, ignoring armor", () => {
    const s = rigged(["heavy"]);
    s.enemy.intentIndex = 2; // brute defend: no counterattack this turn
    const hp = s.enemy.hp;
    playCard(s, 0);
    expect(s.enemy.hp).toBe(hp - 10);
    // Recoil lands on HP even though armor mechanics exist.
    expect(s.player.hp).toBe(40 - 2);
  });

  it("wound poisons: ticks before the enemy acts, then decays", () => {
    const s = rigged(["wound", "strike"]);
    s.enemy.hp = 30;
    playCard(s, 0); // 4 dmg + 2 poison; poison ticks 2 before enemy acts
    expect(s.enemy.hp).toBe(30 - 4 - 2);
    expect(s.enemy.poison).toBe(1);
  });

  it("rally heals, capped at max HP", () => {
    const s = rigged(["rally"]);
    s.enemy.intentIndex = 2; // brute defend: no counterattack this turn
    s.player.hp = 39;
    playCard(s, 0);
    expect(s.player.hp).toBe(40);
  });

  it("refills the hand and reshuffles the discard when the deck empties", () => {
    const s = rigged(["strike"]);
    s.deck = [];
    s.discard = ["block", "block", "wound"];
    playCard(s, 0);
    expect(s.hand).toHaveLength(4);
    expect(s.deck).toHaveLength(0);
  });

  it("advances and wraps the intent cycle", () => {
    const s = rigged(["strike", "strike", "strike", "strike", "strike"]);
    s.deck = [];
    const first = JSON.stringify(currentIntent(s));
    playCard(s, 0);
    expect(JSON.stringify(currentIntent(s))).not.toBe(first);
  });

  it("wins when the enemy falls, loses when the player falls", () => {
    const win = rigged(["strike"]);
    win.enemy.hp = 5;
    playCard(win, 0);
    expect(win.phase).toBe("won");

    const loss = rigged(["strike"]);
    loss.player.hp = 1;
    loss.enemy.intentIndex = 0; // brute attack 8
    loss.enemy.archetype = "brute";
    playCard(loss, 0);
    expect(loss.phase).toBe("lost");
  });

  it("counts the turn cap as a loss", () => {
    const s = rigged(["rally"]);
    s.turn = 60;
    playCard(s, 0, 60);
    expect(s.phase).toBe("lost");
  });

  it("rejects bad input", () => {
    const s = rigged(["strike"]);
    expect(() => playCard(s, 9)).toThrow();
    playCard(s, 0);
    // Duel may still be playing; force the end then act again.
    s.phase = "won";
    expect(() => playCard(s, 0)).toThrow();
  });

  it("same seed + same cards = identical state", () => {
    const a = createDuel(11);
    const b = createDuel(11);
    for (let i = 0; i < 5; i++) {
      playCard(a, 0);
      playCard(b, 0);
      if (a.phase !== "playing") break;
    }
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
