import { describe, expect, it } from "vitest";
import { makePolicy } from "../src/agent/factory.ts";
import { ENCODERS } from "../src/encoders/index.ts";
import { playDuel, type DecisionEvent } from "../src/sim/runner.ts";

const env = { decisionBaseUrl: "http://localhost:11434" };

describe("playDuel", () => {
  it("finishes duels deterministically for scripted policies", async () => {
    const a = await playDuel({ seed: 100, policy: makePolicy("greedy", 100, env), encoder: ENCODERS.features, enemy: "brute" });
    const b = await playDuel({ seed: 100, policy: makePolicy("greedy", 100, env), encoder: ENCODERS.features, enemy: "brute" });
    expect(a).toEqual(b);
    expect(a.decisions).toBeGreaterThan(0);
    expect(a.failures).toBe(0);
    expect(["win", "loss", "cap"]).toContain(a.endedBy);
  });

  it("records labeler answers without playing them", async () => {
    const seen: DecisionEvent[] = [];
    await playDuel({
      seed: 101,
      policy: makePolicy("random", 101, env),
      encoder: ENCODERS.features,
      enemy: "warden",
      labeler: makePolicy("greedy", 101, env),
      onDecision: (ev) => seen.push(ev),
    });
    expect(seen.length).toBeGreaterThan(0);
    for (const ev of seen) expect(ev.label).toBeDefined();
  });

  it("counts illegal moves as failures and stops", async () => {
    const rigged = { name: "rigged", async decide() { return { choice: "9", latencyMs: 0 }; } };
    const sum = await playDuel({ seed: 102, policy: rigged, encoder: ENCODERS.features, enemy: "brute" });
    expect(sum.failures).toBe(1);
    expect(sum.decisions).toBe(0);
  });
});
