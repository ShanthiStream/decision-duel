// Drives one seeded duel with a policy, headless. Shared by the evaluation
// runner and the teacher data generator so both see the same duel. Turn-based:
// the duel always waits for the answer; a failed answer abandons the duel.
import type { Policy, PolicyDecision } from "../agent/policies.ts";
import { optionToInput, type EncodedDecision, type Encoder } from "../encoders/types.ts";
import { createDuel, DEFAULT_MAX_TURNS, playCard } from "../engine/duel.ts";
import type { DuelState, EnemyArchetype } from "../engine/types.ts";

export interface DuelRunOptions {
  seed: number;
  policy: Policy;
  encoder: Encoder;
  enemy?: EnemyArchetype;
  maxTurns?: number;
  /** Optional second policy asked about every turn the player takes; its answer is not played. */
  labeler?: Policy;
  /** More encoders applied to the same state every turn, so one run can train students that read different inputs. */
  alsoEncode?: Encoder[];
  onDecision?: (ev: DecisionEvent) => void;
}

export interface DecisionEvent {
  seed: number;
  enemy: EnemyArchetype;
  turn: number;
  enc: EncodedDecision;
  /** The same state under each of `alsoEncode`, by encoder name. */
  alt?: Record<string, EncodedDecision>;
  decision: PolicyDecision | null;
  /** Labeler's answer; null if the labeler failed on this state. */
  label?: PolicyDecision | null;
  error?: string;
}

export interface DuelSummary {
  seed: number;
  enemy: EnemyArchetype;
  won: boolean;
  turns: number;
  playerHpLeft: number;
  enemyHpLeft: number;
  decisions: number;
  failures: number;
  latencyP50: number;
  latencyP90: number;
  endedBy: "win" | "loss" | "cap";
}

export function percentile(xs: number[], p: number): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
}

async function tryDecide(policy: Policy, enc: EncodedDecision, game: DuelState): Promise<{ d: PolicyDecision | null; error?: string }> {
  try {
    return { d: await policy.decide(enc, undefined, game) };
  } catch (err) {
    return { d: null, error: String((err as Error).message ?? err) };
  }
}

export async function playDuel(o: DuelRunOptions): Promise<DuelSummary> {
  const maxTurns = o.maxTurns ?? DEFAULT_MAX_TURNS;
  const s: DuelState = createDuel(o.seed, { enemy: o.enemy });
  const latencies: number[] = [];
  let decisions = 0;
  let failures = 0;

  while (s.phase === "playing") {
    const turn = s.turn;
    const enc = o.encoder.encode(s);
    const alt = o.alsoEncode?.length ? Object.fromEntries(o.alsoEncode.map((e) => [e.name, e.encode(s)])) : undefined;
    const [played, labeled] = await Promise.all([
      tryDecide(o.policy, enc, s),
      o.labeler && o.labeler !== o.policy ? tryDecide(o.labeler, enc, s) : Promise.resolve(null),
    ]);
    const d = played.d;
    const label = o.labeler ? (o.labeler === o.policy ? d : (labeled?.d ?? null)) : undefined;
    if (!d) {
      failures++;
      o.onDecision?.({ seed: o.seed, enemy: s.enemy.archetype, turn, enc, alt, decision: null, label, error: played.error });
      break;
    }
    let input: number;
    try {
      input = optionToInput(d.choice);
      playCard(s, input, maxTurns);
    } catch (err) {
      failures++;
      o.onDecision?.({ seed: o.seed, enemy: s.enemy.archetype, turn, enc, alt, decision: d, label, error: String((err as Error).message ?? err) });
      break;
    }
    decisions++;
    latencies.push(d.latencyMs);
    o.onDecision?.({ seed: o.seed, enemy: s.enemy.archetype, turn, enc, alt, decision: d, label });
  }

  return {
    seed: o.seed,
    enemy: s.enemy.archetype,
    won: s.phase === "won",
    turns: s.stats.turns,
    playerHpLeft: Math.max(0, s.player.hp),
    enemyHpLeft: Math.max(0, s.enemy.hp),
    decisions,
    failures,
    latencyP50: Math.round(percentile(latencies, 0.5)),
    latencyP90: Math.round(percentile(latencies, 0.9)),
    endedBy: s.phase === "won" ? "win" : s.player.hp > 0 && s.enemy.hp > 0 ? "cap" : "loss",
  };
}
