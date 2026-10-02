import { CARDS } from "../engine/cards.ts";
import { currentIntent, playCard } from "../engine/duel.ts";
import type { CardId, DuelState } from "../engine/types.ts";
import type { EncodedDecision, Encoder } from "./types.ts";

const INSTRUCTIONS = [
  "You play one card per turn against the enemy.",
  "Armor absorbs damage, then expires at the start of that side's next turn.",
  "Poison on the enemy ticks before it acts, then decays by 1.",
  "Heal cannot exceed max HP. Heavy costs 2 of your HP.",
  "You win by reducing the enemy to 0 HP. You lose at 0 HP or after 60 turns.",
  "Reply with the hand index to play.",
].join(" ");

export interface CardFacts {
  card: CardId;
  dmg: number;
  blockGained: number;
  selfDmg: number;
  poisonApplied: number;
  poisonTick: number;
  heal: number;
  enemyHpAfter: number;
  playerHpAfter: number;
}

/**
 * Aftermath facts for playing the card, computed by cloning the duel and
 * running the real rules — so the facts cannot drift from the engine.
 * Numeric outcomes only (HP after), never judgments.
 */
export function previewCard(s: DuelState, handIndex: number): CardFacts {
  const card = CARDS[s.hand[handIndex]];
  const clone: DuelState = structuredClone(s);
  playCard(clone, handIndex);
  // Split the clone's HP deltas into card damage vs. the poison tick: the tick
  // equals the stacks present after the card resolves (existing + applied),
  // and applies only if the card itself did not already end the duel.
  const dmg = Math.max(0, card.damage - Math.min(s.enemy.armor, card.damage));
  const enemyAfterCard = s.enemy.hp - dmg;
  const tick = enemyAfterCard > 0 ? s.enemy.poison + card.poison : 0;
  return {
    card: card.id,
    dmg,
    blockGained: card.block,
    selfDmg: card.selfDamage,
    poisonApplied: card.poison,
    poisonTick: tick,
    heal: card.heal > 0 ? Math.min(card.heal, s.player.maxHp - s.player.hp) : 0,
    enemyHpAfter: clone.enemy.hp,
    playerHpAfter: clone.player.hp,
  };
}

function describe(id: CardId): string {
  const c = CARDS[id];
  const parts: string[] = [];
  if (c.damage) parts.push(`${c.damage} dmg`);
  if (c.block) parts.push(`+${c.block} armor`);
  if (c.poison) parts.push(`+${c.poison} poison`);
  if (c.heal) parts.push(`heal ${c.heal}`);
  if (c.selfDamage) parts.push(`self ${c.selfDamage}`);
  return `${c.name}: ${parts.join(", ")}`;
}

export const featuresEncoder: Encoder = {
  name: "features",
  encode(s: DuelState): EncodedDecision {
    const intent = currentIntent(s);
    const options: Record<string, CardFacts> = {};
    const criteria: Record<string, string | null> = {};
    const keys = s.hand.map((_, i) => String(i));
    for (let i = 0; i < s.hand.length; i++) {
      options[String(i)] = previewCard(s, i);
      criteria[String(i)] = describe(s.hand[i]);
    }
    return {
      encoder: "features",
      state: {
        turn: s.turn,
        player: { hp: s.player.hp, maxHp: s.player.maxHp },
        enemy: {
          hp: s.enemy.hp,
          maxHp: s.enemy.maxHp,
          armor: s.enemy.armor,
          poison: s.enemy.poison,
          intent: intent.kind === "attack" ? `attack ${intent.value}` : `defend ${intent.value}`,
          archetype: s.enemy.archetype,
        },
        hand: [...s.hand],
        deckLeft: s.deck.length,
        discardLeft: s.discard.length,
        options,
      },
      instructions: INSTRUCTIONS,
      criteria,
      keys,
    };
  },
};
