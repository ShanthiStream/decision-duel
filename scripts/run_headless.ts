// Plays seeded duels without rendering and writes one JSONL record per turn.
//
//   npm run headless -- --policy tev1:0.8b --games 5 --seed 100 --enemy both
//   npm run headless -- --policy greedy --games 20 --seed 100
//
// Turn-based: the duel waits for every answer. Latency is logged, never charged.
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { loadDotEnv, makePolicy, policyEnvFromProcess } from "../src/agent/factory.ts";
import { ENCODERS } from "../src/encoders/index.ts";
import { DEFAULT_MAX_TURNS } from "../src/engine/duel.ts";
import type { EnemyArchetype } from "../src/engine/types.ts";
import { percentile, playDuel, type DuelSummary } from "../src/sim/runner.ts";

loadDotEnv();

const { values: args } = parseArgs({
  options: {
    policy: { type: "string", default: "tev1:0.8b" },
    "base-url": { type: "string" },
    encoder: { type: "string", default: "features" },
    enemy: { type: "string", default: "both" },
    games: { type: "string", default: "3" },
    seed: { type: "string", default: "100" },
    "max-turns": { type: "string", default: String(DEFAULT_MAX_TURNS) },
    out: { type: "string", default: "runs" },
  },
});

const enemies: EnemyArchetype[] =
  args.enemy === "both" ? ["brute", "warden"] : args.enemy === "brute" || args.enemy === "warden" ? [args.enemy] : [];
if (enemies.length === 0) throw new Error("--enemy must be brute, warden, or both");

async function main() {
  const env = policyEnvFromProcess();
  if (args["base-url"]) env.decisionBaseUrl = args["base-url"];
  const games = Number(args.games);
  const seed0 = Number(args.seed);
  const maxTurns = Number(args["max-turns"]);
  const tag = `${new Date().toISOString().replace(/[:.]/g, "-")}_${args.policy!.replace(/[^\w.-]/g, "_")}_${args.encoder}_${args.enemy}_p${process.pid}`;
  const dir = join(args.out!, tag);
  mkdirSync(dir, { recursive: true });
  const logPath = join(dir, "decisions.jsonl");
  writeFileSync(logPath, "");

  const summaries: DuelSummary[] = [];
  for (const enemy of enemies) {
    for (let g = 0; g < games; g++) {
      const seed = seed0 + g;
      const policy = makePolicy(args.policy!, seed, env);
      const encoder = ENCODERS[policy.requiresEncoder ?? args.encoder!];
      if (!encoder) throw new Error(`unknown encoder ${args.encoder}`);
      const sum = await playDuel({
        seed,
        policy,
        encoder,
        enemy,
        maxTurns,
        onDecision: (ev) => appendFileSync(logPath, JSON.stringify(ev) + "\n"),
      });
      summaries.push(sum);
      console.log(
        `seed ${seed} vs ${enemy}: ${sum.won ? "WIN" : sum.endedBy.toUpperCase()} in ${sum.turns} turns, ` +
          `HP ${sum.playerHpLeft}/40, ${sum.decisions} decisions (${sum.failures} failed), p50 ${sum.latencyP50} ms`,
      );
    }
  }

  const wins = summaries.filter((s) => s.won).length;
  const lat = summaries.flatMap((s) => Array(s.decisions).fill(s.latencyP50));
  const overall = {
    policy: args.policy,
    encoder: args.encoder,
    enemy: args.enemy,
    games: summaries.length,
    winRate: wins / summaries.length,
    meanTurns: summaries.reduce((a, s) => a + s.turns, 0) / summaries.length,
    meanHpLeft: summaries.reduce((a, s) => a + s.playerHpLeft, 0) / summaries.length,
    meanLatencyP50: Math.round(percentile(lat, 0.5)),
    failures: summaries.reduce((a, s) => a + s.failures, 0),
    byEnemy: Object.fromEntries(
      enemies.map((e) => {
        const rows = summaries.filter((s) => s.enemy === e);
        return [e, { games: rows.length, winRate: rows.filter((s) => s.won).length / rows.length }];
      }),
    ),
  };
  console.log(JSON.stringify(overall));
  writeFileSync(join(dir, "summary.json"), JSON.stringify({ ...overall, summaries }, null, 2));
  console.log(`wrote ${dir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
