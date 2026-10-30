import { APICallError, LoadAPIKeyError, RetryError } from "ai";
import { describe, expect, it } from "vitest";
import { ChatConfigError, DEFAULT_CHAT_MODEL, getChatConfig } from "./config";
import { describeModelError } from "./errors";

const KEY = "sk-ant-secret-value-123";

describe("getChatConfig", () => {
  it("defaults to Haiku 5.5 on Anthropic", () => {
    expect(getChatConfig({ ANTHROPIC_API_KEY: KEY })).toMatchObject({
      modelId: DEFAULT_CHAT_MODEL,
      provider: "anthropic",
      apiKeyEnv: "ANTHROPIC_API_KEY",
    });
  });

  it("uses CHAT_MODEL when set", () => {
    expect(getChatConfig({ ANTHROPIC_API_KEY: KEY, CHAT_MODEL: "anthropic:claude-sonnet-5-5" }).modelId).toBe(
      "anthropic:claude-sonnet-5-5",
    );
  });

  it("names the missing env var when there's no API key", () => {
    for (const env of [{}, { ANTHROPIC_API_KEY: "   " }]) {
      expect(() => getChatConfig(env)).toThrow(ChatConfigError);
      expect(() => getChatConfig(env)).toThrow(/Set ANTHROPIC_API_KEY in \.env\.local/);
    }
  });

  it("explains an invalid CHAT_MODEL", () => {
    for (const model of ["claude-haiku-5-5", "openai:gpt", "anthropic:"]) {
      expect(() => getChatConfig({ ANTHROPIC_API_KEY: KEY, CHAT_MODEL: model })).toThrow(
        /CHAT_MODEL .* isn't valid/,
      );
    }
  });
});

describe("describeModelError", () => {
  const config = getChatConfig({ ANTHROPIC_API_KEY: KEY });
  const apiError = (statusCode: number) =>
    new APICallError({
      message: `failed for key ${KEY}`,
      url: "https://api.anthropic.com/v1/messages",
      requestBodyValues: { apiKey: KEY },
      statusCode,
      responseBody: `{"error":"invalid x-api-key ${KEY}"}`,
    });

  it.each([
    [401, "invalid_credentials", /rejected the API key in ANTHROPIC_API_KEY/],
    [403, "invalid_credentials", /rejected the API key/],
    [404, "model_not_found", /doesn't recognize the model/],
    [429, "rate_limited", /rate limiting/],
    [500, "provider_error", /something went wrong/],
  ])("maps HTTP %i to %s", (status, code, message) => {
    const described = describeModelError(apiError(status), config);
    expect(described.code).toBe(code);
    expect(described.message).toMatch(message);
  });

  it("never includes the key, even when the provider error does", () => {
    for (const status of [401, 403, 404, 429, 500]) {
      expect(describeModelError(apiError(status), config).message).not.toContain(KEY);
    }
  });

  it("unwraps retry errors", () => {
    const retry = new RetryError({ message: "retries failed", reason: "maxRetriesExceeded", errors: [apiError(401)] });
    expect(describeModelError(retry, config).code).toBe("invalid_credentials");
  });

  it("handles a missing key reported by the provider SDK", () => {
    const error = new LoadAPIKeyError({ message: "Anthropic API key is missing" });
    expect(describeModelError(error, config)).toMatchObject({ code: "missing_credentials" });
  });
});
