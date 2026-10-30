import "server-only";
import { anthropic } from "@ai-sdk/anthropic";
import { createProviderRegistry } from "ai";

// Every provider the app can talk to. Adding one is: install its @ai-sdk
// package, register it here, and point CHAT_MODEL at "<provider>:<model>".
// Each provider reads its own API key env var (e.g. ANTHROPIC_API_KEY).
export const providers = { anthropic };

export type ProviderId = keyof typeof providers;

export const registry = createProviderRegistry(providers);
