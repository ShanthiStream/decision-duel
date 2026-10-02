import { featuresEncoder } from "./features.ts";
import type { Encoder } from "./types.ts";

export const ENCODERS: Record<string, Encoder> = {
  features: featuresEncoder,
};

export const DEFAULT_ENCODER = "features";
