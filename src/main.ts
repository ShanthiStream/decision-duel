import { DecisionApiError } from "./agent/client.ts";
import { llmPolicy, policyNamesForCapabilities } from "./agent/llm.ts";
import { greedyPolicy, randomPolicy, systemOnePolicy, type Policy } from "./agent/policies.ts";
import { oraclePolicy } from "./agent/oracle.ts";
import { ENCODERS, DEFAULT_ENCODER } from "./encoders/index.ts";
import { optionToInput } from "./encoders/types.ts";
import { createDuel, playCard } from "./engine/duel.ts";
import type { DuelState, EnemyArchetype } from "./engine/types.ts";
import { renderTable } from "./render/table.ts";

const params = new URLSearchParams(location.search);
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

// ---- configuration -----------------------------------------------------------
const defaultEndpoint = import.meta.env.DEV ? "/decide" : (import.meta.env.VITE_DECISION_BASE_URL ?? "http://localhost:11434");
const config = {
  side: (params.get("side") ?? "human") as "human" | "ai",
  model: params.get("model") ?? import.meta.env.VITE_DEFAULT_MODEL ?? "tev1:0.8b",
  enemy: (params.get("enemy") ?? "brute") as EnemyArchetype,
  seed: Number(params.get("seed") ?? Math.floor(Math.random() * 1e6)),
  endpoint: params.get("endpoint") ?? defaultEndpoint,
};

// ---- duel state ----------------------------------------------------------------
let duel: DuelState = createDuel(config.seed, { enemy: config.enemy });
let lastProbs: { keys: string[]; probs: Record<string, number>; choice: string } | null = null;
let aiTimer: number | null = null;
const records: object[] = [];

// ---- agent -------------------------------------------------------------------
function makePolicy(name: string): Policy {
  if (name === "random") return randomPolicy(config.seed);
  if (name === "greedy") return greedyPolicy();
  const oracle = /^oracle(?:-(\d+)t)?$/.exec(name);
  if (oracle) return oraclePolicy({ turns: oracle[1] ? Number(oracle[1]) : 6 });
  if (name.startsWith("llm-think:")) {
    return llmPolicy({ baseUrl: config.endpoint, model: name.slice("llm-think:".length), think: true, numPredict: 1024, timeoutMs: 120_000 });
  }
  if (name.startsWith("llm:")) return llmPolicy({ baseUrl: config.endpoint, model: name.slice("llm:".length) });
  return systemOnePolicy({ baseUrl: config.endpoint, model: name });
}

/** Models offered when Ollama cannot be reached; the live list replaces them. */
const KNOWN_MODELS = ["tev1:0.8b", "tev1:4b", "greedy", "random", "oracle-6t", "llm:phi4-mini"];
const CUSTOM_MODEL = "__custom__";

/** Rebuilds the model dropdown, keeping the active model selected even if Ollama omits it. */
function setModelOptions(names: string[]): void {
  const sel = $<HTMLSelectElement>("model");
  const ordered = [...names];
  if (!ordered.includes(config.model)) ordered.push(config.model);
  sel.innerHTML = "";
  const seen = new Set<string>();
  for (const name of ordered) {
    if (seen.has(name)) continue;
    seen.add(name);
    sel.add(new Option(name, name));
  }
  sel.add(new Option("Custom…", CUSTOM_MODEL));
  sel.value = config.model;
}

async function loadModels(): Promise<void> {
  try {
    const res = await fetch(`${config.endpoint.replace(/\/$/, "")}/api/tags`);
    if (!res.ok) return;
    const body = (await res.json()) as { models?: { name?: string; capabilities?: string[] }[] };
    const found = (body.models ?? []).filter((m) => typeof m.name === "string" && m.name.length > 0);
    // List exactly what the endpoint serves, each under the policies that can play it.
    if (found.length) setModelOptions([...new Set(found.flatMap((m) => policyNamesForCapabilities(m.name!, m.capabilities ?? [])))]);
  } catch {
    // The dropdown already lists known models; decisions report their own errors.
  }
}

// ---- rendering -----------------------------------------------------------------
function render(): void {
  renderTable($("table"), duel, config.side === "human", playHuman);
  const bars = $("bars");
  bars.innerHTML = "";
  if (lastProbs) {
    $("who").textContent = `${config.model} chose ${lastProbs.choice}`;
    for (const key of lastProbs.keys) {
      const p = lastProbs.probs[key] ?? 0;
      const row = document.createElement("div");
      row.className = `prob${key === lastProbs.choice ? " chosen" : ""}`;
      row.innerHTML = `<span>${key}</span><div class="track"><div class="fill" style="width:${(p * 100).toFixed(1)}%"></div></div><span>${(p * 100).toFixed(0)}%</span>`;
      bars.appendChild(row);
    }
  } else {
    $("who").textContent = config.side === "ai" ? "waiting for the first decision..." : "your move: click a card";
  }
}

function showError(err: unknown): void {
  const box = $("error");
  box.classList.add("show");
  if (err instanceof DecisionApiError) {
    $("error-message").textContent = err.message;
    $("error-hint").textContent = err.hint;
  } else {
    $("error-message").textContent = String(err);
    $("error-hint").textContent = "";
  }
}

function hideError(): void {
  $("error").classList.remove("show");
}

// ---- turns ---------------------------------------------------------------------
function playHuman(i: number): void {
  if (config.side !== "human" || duel.phase !== "playing") return;
  try {
    playCard(duel, i);
    hideError();
  } catch (err) {
    showError(err);
  }
  render();
}

async function playAiTurn(): Promise<void> {
  if (config.side !== "ai" || duel.phase !== "playing") return;
  hideError();
  try {
    const policy = makePolicy(config.model);
    const enc = (ENCODERS[DEFAULT_ENCODER] ?? ENCODERS.features).encode(duel);
    const started = performance.now();
    const d = await policy.decide(enc, undefined, duel);
    records.push({ seed: config.seed, turn: duel.turn, policy: policy.name, choice: d.choice, values: d.values ?? null, latencyMs: Math.round(performance.now() - started) });
    playCard(duel, optionToInput(d.choice));
    if (d.probabilities) lastProbs = { keys: enc.keys, probs: d.probabilities, choice: d.choice };
    else lastProbs = null;
  } catch (err) {
    showError(err);
    return;
  }
  render();
  if (duel.phase === "playing") {
    aiTimer = window.setTimeout(() => void playAiTurn(), 500);
  }
}

function stopAi(): void {
  if (aiTimer !== null) {
    clearTimeout(aiTimer);
    aiTimer = null;
  }
}

function newDuel(): void {
  stopAi();
  duel = createDuel(config.seed, { enemy: config.enemy });
  lastProbs = null;
  records.length = 0;
  hideError();
  render();
  if (config.side === "ai") void playAiTurn();
}

// ---- controls ------------------------------------------------------------------
function setupControls(): void {
  const side = $<HTMLSelectElement>("side");
  const model = $<HTMLSelectElement>("model");
  const enemy = $<HTMLSelectElement>("enemy");
  const seed = $<HTMLInputElement>("seed");

  setModelOptions(KNOWN_MODELS);
  side.value = config.side;
  model.value = config.model;
  enemy.value = config.enemy;
  seed.value = String(config.seed);

  side.onchange = () => {
    config.side = side.value as "human" | "ai";
    stopAi();
    render();
    if (config.side === "ai" && duel.phase === "playing") void playAiTurn();
  };
  model.onchange = () => {
    if (model.value === CUSTOM_MODEL) {
      const name = window.prompt("Model or policy name (llm: for chat, llm-think: for reasoning models):", config.model)?.trim();
      setModel(name || config.model);
    } else setModel(model.value);
  };
  enemy.onchange = () => {
    config.enemy = enemy.value as EnemyArchetype;
    newDuel();
  };
  seed.onchange = () => {
    const n = Number(seed.value);
    if (Number.isInteger(n)) {
      config.seed = n;
      newDuel();
    }
  };
  $("new").onclick = () => {
    config.seed = Math.floor(Math.random() * 1e6);
    seed.value = String(config.seed);
    newDuel();
  };
  $("models-refresh").onclick = () => void loadModels();
  $("export").onclick = () => {
    const blob = new Blob(records.map((r) => JSON.stringify(r) + "\n"), { type: "application/x-ndjson" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `duel-${Date.now()}.jsonl`;
    a.click();
  };

  window.addEventListener("keydown", (e) => {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
    const i = ["1", "2", "3", "4"].indexOf(e.key);
    if (i >= 0) playHuman(i);
  });
}

/** Switches the model; latency and the probability bars start over for it. */
function setModel(value: string): void {
  config.model = value;
  const sel = $<HTMLSelectElement>("model");
  if (![...sel.options].some((o) => o.value === value)) sel.add(new Option(value, value));
  sel.value = value;
  stopAi();
  lastProbs = null;
  hideError();
  render();
  if (config.side === "ai") newDuel();
}

setupControls();
void loadModels();
newDuel();

// Exposed for debugging and scripted control.
(window as unknown as { __duel: object }).__duel = {
  get duel() {
    return duel;
  },
  records,
  setModel,
  newDuel,
};
