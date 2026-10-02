import type { CardFacts } from "../encoders/features.ts";
import type { EncodedDecision } from "../encoders/types.ts";
import type { DuelState } from "../engine/types.ts";
import { askSystemOne, type SystemOneConfig } from "./client.ts";

export interface PolicyDecision {
  choice: string;
  probabilities?: Record<string, number>;
  /** Per-option values from search policies (higher is better; not probabilities). */
  values?: Record<string, number>;
  confidence?: number;
  inputTokens?: number;
  latencyMs: number;
}

export interface Policy {
  name: string;
  /** Encoder this policy expects, when it reads the encoding itself. */
  requiresEncoder?: string;
  /** `game` is the live state, for policies that search the engine instead of reading the encoding. */
  decide(enc: EncodedDecision, signal?: AbortSignal, game?: DuelState): Promise<PolicyDecision>;
}

export function systemOnePolicy(cfg: SystemOneConfig): Policy {
  return {
    name: cfg.model,
    async decide(enc, signal) {
      const a = await askSystemOne(cfg, enc, signal);
      return a;
    },
  };
}

/** Uniform over the legal options, with its own seeded generator. */
export function randomPolicy(seed = 1): Policy {
  let t = seed | 0;
  const rand = () => {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
  return {
    name: "random",
    async decide(enc) {
      return { choice: enc.keys[Math.floor(rand() * enc.keys.length)], latencyMs: 0 };
    },
  };
}

interface FactsState {
  player: { hp: number };
  enemy: { hp: number };
  options: Record<string, CardFacts>;
}

/**
 * Scripted baseline over the features encoder: take a surviving kill, else
 * trade HP favorably (enemy damage counts 1.5x own damage). Reads the same
 * numeric facts as the models — the bar they must beat.
 */
export function greedyChoice(enc: EncodedDecision): string {
  const s = enc.state as FactsState;
  const keys = enc.keys.filter((k) => s.options[k]);
  const score = (k: string): number => {
    const f = s.options[k];
    const enemyLost = s.enemy.hp - Math.max(0, f.enemyHpAfter);
    const ownLost = s.player.hp - Math.max(0, f.playerHpAfter);
    return enemyLost - 1.5 * ownLost + (f.enemyHpAfter <= 0 && f.playerHpAfter > 0 ? 500 : 0);
  };
  let best = keys[0];
  for (const k of keys.slice(1)) if (score(k) > score(best)) best = k;
  return best;
}

export function greedyPolicy(): Policy {
  return {
    name: "greedy",
    requiresEncoder: "features",
    async decide(enc) {
      return { choice: greedyChoice(enc), latencyMs: 0 };
    },
  };
}
