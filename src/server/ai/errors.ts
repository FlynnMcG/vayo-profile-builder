import "server-only";
import { APICallError, LoadAPIKeyError, RetryError } from "ai";
import type { ChatConfig } from "./config";

export type ModelErrorCode =
  | "missing_credentials"
  | "invalid_credentials"
  | "model_not_found"
  | "rate_limited"
  | "provider_error";

// The underlying error, unwrapping the SDK's retry wrapper.
function rootError(error: unknown): unknown {
  return RetryError.isInstance(error) ? error.lastError : error;
}

// Maps a provider failure to a message that's safe to show the user. These
// are written here, never copied from the error, so they can't leak a key.
export function describeModelError(
  error: unknown,
  config: Pick<ChatConfig, "provider" | "apiKeyEnv" | "modelId">,
): { code: ModelErrorCode; message: string } {
  const root = rootError(error);

  if (LoadAPIKeyError.isInstance(root)) {
    return {
      code: "missing_credentials",
      message: `No API key configured for ${config.provider}. Set ${config.apiKeyEnv} in .env.local and restart the server.`,
    };
  }

  if (APICallError.isInstance(root)) {
    switch (root.statusCode) {
      case 401:
      case 403:
        return {
          code: "invalid_credentials",
          message: `${config.provider} rejected the API key in ${config.apiKeyEnv}. Check that it's correct and active, then restart the server.`,
        };
      case 404:
        return {
          code: "model_not_found",
          message: `${config.provider} doesn't recognize the model in CHAT_MODEL ("${config.modelId}"). Check the model name.`,
        };
      case 429:
        return { code: "rate_limited", message: `${config.provider} is rate limiting requests. Try again in a moment.` };
    }
  }

  return { code: "provider_error", message: "Sorry, something went wrong generating a reply. Please try again." };
}

// Error details safe for logs: no request bodies, headers, or keys.
export function errorSummary(error: unknown) {
  const root = rootError(error);
  return {
    name: root instanceof Error ? root.name : typeof root,
    statusCode: APICallError.isInstance(root) ? root.statusCode : undefined,
    message: root instanceof Error ? root.message.slice(0, 300) : undefined,
  };
}
