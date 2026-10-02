// Engine rollouts: play an option on a copy of the duel, then greedy moves
// for the rest of the horizon. The outcomes label training data (the teacher
// sees them); the search itself sees the future, so it is never a compared
// player.
import { featuresEncoder } from "../encoders/features.ts";
import { playCard } from "../engine/duel.ts";
import type { DuelState } from "../engine/types.ts";
import { greedyChoice } from "./policies.ts";
import type { Policy } from "./policies.ts";

export interface PeekOutcome {
  damageDealt: number;
  damageTaken: number;
  turnsPlayed: number;
  won: boolean;
  lost: boolean;
}

/** Copies the duel, plays `key`, then greedy for up to `turns` more turns. */
export function rollout(game: DuelState, key: string, turns: number): PeekOutcome {
  const s: DuelState = structuredClone(game);
  const dealtBefore = s.stats.damageDealt;
  const takenBefore = s.stats.damageTaken;
  playCard(s, Number(key));
  let played = 1;
  // Greedy reads encoded facts; re-encode the rollout state each turn.
  while (s.phase === "playing" && played < 1 + turns) {
    playCard(s, Number(greedyChoice(featuresEncoder.encode(s))));
    played++;
  }
  return {
    damageDealt: s.stats.damageDealt - dealtBefore,
    damageTaken: s.stats.damageTaken - takenBefore,
    turnsPlayed: played,
    won: s.phase === "won",
    lost: s.phase === "lost",
  };
}

/** One named outcome per option, for the teacher's labeling prompt. */
export function peek(game: DuelState, key: string, turns: number): PeekOutcome {
  return rollout(game, key, turns);
}

export function scoreOutcome(o: PeekOutcome): number {
  return o.damageDealt - 1.5 * o.damageTaken + (o.won ? 500 : 0) - (o.lost ? 500 : 0);
}

export function oraclePolicy(opts: { turns?: number } = {}): Policy {
  const turns = opts.turns ?? 6;
  return {
    name: `oracle-${turns}t`,
    requiresEncoder: "features",
    async decide(enc, _signal, game) {
      if (!game) throw new Error("oracle needs the live duel state");
      const values: Record<string, number> = {};
      for (const key of enc.keys) values[key] = scoreOutcome(rollout(game, key, turns));
      let best = enc.keys[0];
      for (const k of enc.keys.slice(1)) if (values[k] > values[best]) best = k;
      return { choice: best, values, latencyMs: 0 };
    },
  };
}
