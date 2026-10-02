import { CARDS, DECK_LIST, ENEMIES, HAND_SIZE } from "./cards.ts";
import { nextRandom } from "./rng.ts";
import type { CardId, Combatant, DuelOptions, DuelState, EnemyArchetype, IntentDef } from "./types.ts";

export const DEFAULT_MAX_TURNS = 60;

function makeCombatant(hp: number): Combatant {
  return { hp, maxHp: hp, armor: 0, poison: 0 };
}

/** Damage after armor; armor absorbs first and is consumed. */
function dealDamage(c: Combatant, amount: number): number {
  const absorbed = Math.min(c.armor, amount);
  c.armor -= absorbed;
  const dealt = amount - absorbed;
  c.hp -= dealt;
  return dealt;
}

function shuffle<T>(s: DuelState, xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(nextRandom(s) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function drawUp(s: DuelState): void {
  while (s.hand.length < HAND_SIZE) {
    if (s.deck.length === 0) {
      if (s.discard.length === 0) break;
      s.deck = shuffle(s, s.discard);
      s.discard = [];
    }
    s.hand.push(s.deck.pop()!);
  }
}

export function createDuel(seed: number, options: DuelOptions = {}): DuelState {
  const enemy = options.enemy ?? "brute";
  const s: DuelState = {
    seed,
    rng: seed | 0,
    turn: 1,
    phase: "playing",
    player: makeCombatant(options.playerHp ?? 40),
    enemy: { ...makeCombatant(options.enemyHp ?? ENEMIES[enemy].hp), archetype: enemy, intentIndex: 0 },
    deck: [],
    hand: [],
    discard: [],
    stats: { turns: 0, damageDealt: 0, damageTaken: 0 },
    events: [],
  };
  // Pattern start offset from the seed, so seeds vary the enemy's opening.
  s.enemy.intentIndex = ((seed % ENEMIES[enemy].pattern.length) + ENEMIES[enemy].pattern.length) % ENEMIES[enemy].pattern.length;
  s.deck = shuffle(s, DECK_LIST);
  drawUp(s);
  return s;
}

/** The enemy's upcoming action, visible before the player chooses. */
export function currentIntent(s: DuelState): IntentDef {
  return ENEMIES[s.enemy.archetype].pattern[s.enemy.intentIndex % ENEMIES[s.enemy.archetype].pattern.length];
}

export function enemyLabel(a: EnemyArchetype): string {
  return ENEMIES[a].label;
}

/**
 * Plays the card at `handIndex`, then runs the enemy's turn and refills the
 * hand. Turn order: leftover player armor expires → card effects → poison
 * ticks → enemy acts on its intent (leftover enemy armor expires first) →
 * intent advances → discard + redraw. Hitting the turn cap counts as a loss.
 */
export function playCard(s: DuelState, handIndex: number, maxTurns = DEFAULT_MAX_TURNS): void {
  if (s.phase !== "playing") throw new Error("duel is over");
  if (!Number.isInteger(handIndex) || handIndex < 0 || handIndex >= s.hand.length) {
    throw new Error(`hand index ${handIndex} out of range (hand: ${s.hand.length})`);
  }
  const id = s.hand[handIndex];
  const card = CARDS[id];
  s.hand.splice(handIndex, 1);
  s.stats.turns++;

  // Leftover player armor expires at the start of the player's action.
  s.player.armor = 0;
  if (card.block > 0) {
    s.player.armor += card.block;
    s.events.push(`P ${id} +${card.block} armor`);
  }
  if (card.damage > 0) {
    const dealt = dealDamage(s.enemy, card.damage);
    s.stats.damageDealt += dealt;
    s.events.push(`P ${id} ${dealt} dmg`);
  }
  if (card.poison > 0) {
    s.enemy.poison += card.poison;
    s.events.push(`P ${id} +${card.poison} poison`);
  }
  if (card.heal > 0) {
    const healed = Math.min(card.heal, s.player.maxHp - s.player.hp);
    s.player.hp += healed;
    s.events.push(`P ${id} +${healed} hp`);
  }
  if (card.selfDamage > 0) {
    s.player.hp -= card.selfDamage;
    s.stats.damageTaken += card.selfDamage;
    s.events.push(`P ${id} -${card.selfDamage} hp`);
  }
  if (s.enemy.hp <= 0) return endDuel(s, true, id);
  if (s.player.hp <= 0) return endDuel(s, false, id);

  // Poison ticks on the enemy before it acts, then decays by 1.
  if (s.enemy.poison > 0) {
    s.enemy.hp -= s.enemy.poison;
    s.stats.damageDealt += s.enemy.poison;
    s.events.push(`poison ${s.enemy.poison} dmg`);
    s.enemy.poison = Math.max(0, s.enemy.poison - 1);
    if (s.enemy.hp <= 0) return endDuel(s, true, id);
  }

  // Enemy turn: leftover enemy armor expires first, then the intent resolves.
  s.enemy.armor = 0;
  const intent = currentIntent(s);
  if (intent.kind === "attack") {
    const dealt = dealDamage(s.player, intent.value);
    s.stats.damageTaken += dealt;
    s.events.push(`E attacks ${dealt}`);
  } else {
    s.enemy.armor += intent.value;
    s.events.push(`E defends +${intent.value}`);
  }
  s.enemy.intentIndex = (s.enemy.intentIndex + 1) % ENEMIES[s.enemy.archetype].pattern.length;
  if (s.player.hp <= 0) return endDuel(s, false, id);

  s.discard.push(id);
  drawUp(s);
  s.turn++;
  if (s.turn > maxTurns) {
    s.phase = "lost";
    s.events.push("turn cap: loss");
  }
}

function endDuel(s: DuelState, won: boolean, id: CardId): void {
  s.phase = won ? "won" : "lost";
  s.discard.push(id);
  s.events.push(won ? "enemy slain: win" : "player slain: loss");
}
