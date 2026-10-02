import { describe, expect, it } from "vitest";
import { makePolicy } from "../src/agent/factory.ts";
import { buildChatRequest, extractMove, policyNamesForCapabilities } from "../src/agent/llm.ts";
import { oraclePolicy } from "../src/agent/oracle.ts";
import { greedyChoice } from "../src/agent/policies.ts";
import { parseTeacherReply, teacherPrompt, TeacherParseError } from "../src/agent/teacher.ts";
import { ENCODERS } from "../src/encoders/index.ts";
import { createDuel } from "../src/engine/duel.ts";

const keys = ["0", "1", "2", "3"];

describe("greedyChoice", () => {
  it("takes a surviving kill", () => {
    const s = createDuel(3);
    s.hand = ["block", "strike", "strike", "strike"];
    s.deck = [];
    s.discard = [];
    s.enemy.hp = 5;
    s.enemy.armor = 0;
    const enc = ENCODERS.features.encode(s);
    expect(greedyChoice(enc)).toBe("1");
  });

  it("trades favorably instead of feeding", () => {
    const s = createDuel(3);
    s.hand = ["rally", "strike", "strike", "strike"];
    s.deck = [];
    s.discard = [];
    s.player.hp = 40;
    s.enemy.hp = 40;
    const enc = ENCODERS.features.encode(s);
    // Rally heals 0 at full HP and deals nothing; strike deals 6.
    expect(greedyChoice(enc)).not.toBe("0");
  });
});

describe("oraclePolicy", () => {
  it("picks lethal and reports per-option values", async () => {
    const s = createDuel(3);
    s.hand = ["block", "strike", "strike", "strike"];
    s.deck = [];
    s.discard = [];
    s.enemy.hp = 5;
    s.enemy.armor = 0;
    const enc = ENCODERS.features.encode(s);
    const d = await oraclePolicy({ turns: 2 }).decide(enc, undefined, s);
    expect(d.choice).toBe("1");
    expect(Object.keys(d.values ?? {})).toEqual(enc.keys);
  });

  it("needs the live duel state", async () => {
    const s = createDuel(3);
    const enc = ENCODERS.features.encode(s);
    await expect(oraclePolicy().decide(enc)).rejects.toThrow();
  });
});

describe("teacher prompt and parsing", () => {
  it("renders state, options, and the answer line", () => {
    const s = createDuel(3);
    const enc = ENCODERS.features.encode(s);
    const prompt = teacherPrompt(enc);
    expect(prompt).toContain(JSON.stringify(enc.state));
    expect(prompt).toContain("- 0:");
    expect(prompt).toContain('"move": "<one of the options>"');
  });

  it("reads the last JSON answer and rejects the rest", () => {
    expect(parseTeacherReply('hmm {"move": "0", "reason": "hits"}', keys)).toEqual({ move: "0", reason: "hits" });
    expect(() => parseTeacherReply('{"move": "9", "reason": "x"}', keys)).toThrow(TeacherParseError);
    expect(() => parseTeacherReply("no json here", keys)).toThrow(TeacherParseError);
  });
});

describe("llm helpers", () => {
  it("builds a constrained request with thinking off by default", () => {
    const s = createDuel(3);
    const enc = ENCODERS.features.encode(s);
    const req = buildChatRequest({ baseUrl: "http://x", model: "m" }, enc) as Record<string, any>;
    expect(req).toMatchObject({ think: false, options: { temperature: 0, num_predict: 32 } });
    expect(req.format.properties.move.enum).toEqual(enc.keys);
  });

  it("extracts moves from traces", () => {
    expect(extractMove('{"move": "2"}', keys)).toBe("2");
    expect(extractMove('thinking... {"move": "1"} ...done {"move": "3"}', keys)).toBe("3");
    expect(() => extractMove("nothing", keys)).toThrow();
  });

  it("routes installed models by capability", () => {
    expect(policyNamesForCapabilities("tev1:0.8b", ["decision"])).toEqual(["tev1:0.8b"]);
    expect(policyNamesForCapabilities("qwen3.5:2b", ["completion"])).toEqual(["llm:qwen3.5:2b", "llm-think:qwen3.5:2b"]);
  });
});

describe("makePolicy", () => {
  const env = { decisionBaseUrl: "http://localhost:11434" };
  it("names every policy family", () => {
    expect(makePolicy("random", 1, env).name).toBe("random");
    expect(makePolicy("greedy", 1, env).name).toBe("greedy");
    expect(makePolicy("oracle", 1, env).name).toBe("oracle-6t");
    expect(makePolicy("oracle-10t", 1, env).name).toBe("oracle-10t");
    expect(makePolicy("llm:phi4-mini", 1, env).name).toBe("llm:phi4-mini");
    expect(makePolicy("llm-think:gpt-oss:20b-cloud", 1, env).name).toBe("llm:gpt-oss:20b-cloud");
    expect(makePolicy("tev1:0.8b", 1, env).name).toBe("tev1:0.8b");
  });

  it("refuses teacher policies without an endpoint", () => {
    expect(() => makePolicy("teacher-peek6t", 1, env)).toThrow();
  });
});
