import "server-only";
import { z } from "zod";
import { PROVIDER_API_KEY_ENV, providers, registry, type ProviderId } from "./registry";

export const DEFAULT_CHAT_MODEL = "anthropic:claude-haiku-5-5";

const providerIds = Object.keys(providers) as [ProviderId, ...ProviderId[]];

// "<provider>:<model>", where provider must be registered in registry.ts.
const ChatModelIdSchema = z.templateLiteral([z.enum(providerIds), ":", z.string().min(1)]);

export interface ChatConfig {
  modelId: z.infer<typeof ChatModelIdSchema>;
  provider: ProviderId;
  apiKeyEnv: string;
  maxOutputTokens: number;
}

export type ChatConfigErrorCode = "invalid_model" | "missing_credentials";

// A setup problem the user can fix. Messages name env vars, never values.
export class ChatConfigError extends Error {
  constructor(
    readonly code: ChatConfigErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ChatConfigError";
  }
}

// Reads and checks the chat config from the environment. Called per request
// so a bad setting gives a clear error instead of crashing the server.
export function getChatConfig(env: Record<string, string | undefined> = process.env): ChatConfig {
  const rawModel = env.CHAT_MODEL?.trim() || DEFAULT_CHAT_MODEL;
  const parsed = ChatModelIdSchema.safeParse(rawModel);
  if (!parsed.success) {
    throw new ChatConfigError(
      "invalid_model",
      `CHAT_MODEL "${rawModel}" isn't valid. Use "<provider>:<model>" with a registered provider (${providerIds.join(", ")}), e.g. "${DEFAULT_CHAT_MODEL}".`,
    );
  }

  const provider = parsed.data.split(":")[0] as ProviderId;
  const apiKeyEnv = PROVIDER_API_KEY_ENV[provider];
  if (!env[apiKeyEnv]?.trim()) {
    throw new ChatConfigError(
      "missing_credentials",
      `No API key configured for ${provider}. Set ${apiKeyEnv} in .env.local and restart the server.`,
    );
  }

  return { modelId: parsed.data, provider, apiKeyEnv, maxOutputTokens: 1024 };
}

// Portable across providers: each provider maps "none" to its own way of
// disabling (or minimizing) thinking.
export const CHAT_REASONING = "none" as const;

export function getChatModel(config: ChatConfig) {
  return registry.languageModel(config.modelId);
}
