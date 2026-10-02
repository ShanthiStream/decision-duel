export type CardId = "strike" | "heavy" | "block" | "wound" | "brace" | "rally";

export interface CardDef {
  id: CardId;
  name: string;
  /** Damage to the enemy. */
  damage: number;
  /** Armor gained (absorbs, then expires at the start of your next turn). */
  block: number;
  /** Direct HP loss, ignoring armor. */
  selfDamage: number;
  /** Poison stacks applied to the enemy (tick down 1 per turn). */
  poison: number;
  /** HP restored, capped at max HP. */
  heal: number;
}

export type EnemyArchetype = "brute" | "warden";

export interface IntentDef {
  kind: "attack" | "defend";
  value: number;
}

export interface EnemyDef {
  label: string;
  hp: number;
  pattern: IntentDef[];
}

export interface Combatant {
  hp: number;
  maxHp: number;
  armor: number;
  poison: number;
}

export type DuelPhase = "playing" | "won" | "lost";

export interface DuelState {
  seed: number;
  rng: number;
  turn: number;
  phase: DuelPhase;
  player: Combatant;
  enemy: Combatant & { archetype: EnemyArchetype; intentIndex: number };
  deck: CardId[];
  hand: CardId[];
  discard: CardId[];
  stats: { turns: number; damageDealt: number; damageTaken: number };
  events: string[];
}

export interface DuelOptions {
  enemy?: EnemyArchetype;
  playerHp?: number;
  enemyHp?: number;
  maxTurns?: number;
}
