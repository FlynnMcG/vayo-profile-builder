import "server-only";
import { SYSTEM_PROMPT_V1 } from "./system-v1";
import { SYSTEM_PROMPT_V2 } from "./system-v2";
import { SYSTEM_PROMPT_V3 } from "./system-v3";
import { SYSTEM_PROMPT_V4 } from "./system-v4";
import { SYSTEM_PROMPT_V5 } from "./system-v5";

// System prompts are versioned so evals can compare them. Each version is
// static (per-turn state goes in the user message; see turn.ts). To change
// the prompt, add a new version and point CURRENT_PROMPT_VERSION at it.
export const SYSTEM_PROMPTS = {
  v1: SYSTEM_PROMPT_V1,
  v2: SYSTEM_PROMPT_V2,
  v3: SYSTEM_PROMPT_V3,
  v4: SYSTEM_PROMPT_V4,
  v5: SYSTEM_PROMPT_V5,
} as const;

export type PromptVersion = keyof typeof SYSTEM_PROMPTS;

export const CURRENT_PROMPT_VERSION: PromptVersion = "v5";

export const isPromptVersion = (value: string): value is PromptVersion => value in SYSTEM_PROMPTS;

export { formatUserTurn } from "./turn";
