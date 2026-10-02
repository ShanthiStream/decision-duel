import type { DuelState } from "../engine/types.ts";

export interface EncodedDecision {
  encoder: string;
  /** Sent as the /v1/systemone `state` (string or JSON). */
  state: unknown;
  instructions: string;
  /** Option key to description (null lets the key describe itself). */
  criteria: Record<string, string | null>;
  /** Hand indices as strings. */
  keys: string[];
}

export interface Encoder {
  name: string;
  encode(s: DuelState): EncodedDecision;
}

/** Maps a chosen option to a hand index. */
export function optionToInput(key: string): number {
  const i = Number(key);
  if (!Number.isInteger(i) || i < 0) throw new Error(`bad option ${key}`);
  return i;
}
