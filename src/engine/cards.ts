import type { CardDef, CardId, EnemyArchetype, EnemyDef } from "./types.ts";

// Balance lives here. Logic in duel.ts must not special-case card ids.
export const CARDS: Record<CardId, CardDef> = {
  strike: { id: "strike", name: "Strike", damage: 6, block: 0, selfDamage: 0, poison: 0, heal: 0 },
  heavy: { id: "heavy", name: "Heavy", damage: 10, block: 0, selfDamage: 2, poison: 0, heal: 0 },
  block: { id: "block", name: "Block", damage: 0, block: 6, selfDamage: 0, poison: 0, heal: 0 },
  wound: { id: "wound", name: "Wound", damage: 4, block: 0, selfDamage: 0, poison: 2, heal: 0 },
  brace: { id: "brace", name: "Brace", damage: 3, block: 3, selfDamage: 0, poison: 0, heal: 0 },
  rally: { id: "rally", name: "Rally", damage: 0, block: 0, selfDamage: 0, poison: 0, heal: 4 },
};

/** Fixed 12-card deck for M1–M4. */
export const DECK_LIST: CardId[] = [
  "strike", "strike", "strike", "strike",
  "heavy", "heavy",
  "block", "block",
  "wound", "wound",
  "brace",
  "rally",
];

export const HAND_SIZE = 4;

export const ENEMIES: Record<EnemyArchetype, EnemyDef> = {
  brute: {
    label: "Brute",
    hp: 40,
    pattern: [
      { kind: "attack", value: 8 },
      { kind: "attack", value: 8 },
      { kind: "defend", value: 6 },
      { kind: "attack", value: 12 },
    ],
  },
  warden: {
    label: "Warden",
    hp: 40,
    pattern: [
      { kind: "defend", value: 8 },
      { kind: "attack", value: 6 },
      { kind: "defend", value: 8 },
      { kind: "attack", value: 10 },
    ],
  },
};
