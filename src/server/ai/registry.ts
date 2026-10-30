import "server-only";
import { anthropic } from "@ai-sdk/anthropic";
import { createProviderRegistry } from "ai";

// Every provider the app can talk to. Adding one is: install its @ai-sdk
// package, register it here and in PROVIDER_API_KEY_ENV, and point
// CHAT_MODEL at "<provider>:<model>".
export const providers = { anthropic };

export type ProviderId = keyof typeof providers;

// The env var each provider reads its API key from (the @ai-sdk default).
// Used to give a clear error when it's missing; the value is never logged.
export const PROVIDER_API_KEY_ENV: Record<ProviderId, string> = {
  anthropic: "ANTHROPIC_API_KEY",
};

export const registry = createProviderRegistry(providers);
