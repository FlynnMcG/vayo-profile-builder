import "server-only";
import { z } from "zod";
import { providers, registry, type ProviderId } from "./registry";

const DEFAULT_CHAT_MODEL = "anthropic:claude-haiku-5-5";

const providerIds = Object.keys(providers) as [ProviderId, ...ProviderId[]];

// "<provider>:<model>", where provider must be registered in registry.ts.
const ChatModelIdSchema = z.templateLiteral([z.enum(providerIds), ":", z.string().min(1)]);

const ChatConfigSchema = z.object({
  modelId: ChatModelIdSchema,
  maxOutputTokens: z.number().int().positive(),
});

export type ChatConfig = z.infer<typeof ChatConfigSchema>;

export const chatConfig: ChatConfig = ChatConfigSchema.parse({
  modelId: process.env.CHAT_MODEL || DEFAULT_CHAT_MODEL,
  maxOutputTokens: 1024,
});

// Portable across providers: each provider maps "none" to its own way of
// disabling (or minimizing) thinking.
export const CHAT_REASONING = "none" as const;

export function getChatModel() {
  return registry.languageModel(chatConfig.modelId);
}
