import { describe, expect, it } from "vitest";
import { chatErrorMessage } from "./errors";

describe("chatErrorMessage", () => {
  it("shows the server's JSON error message", () => {
    const body = JSON.stringify({ code: "missing_credentials", error: "Set ANTHROPIC_API_KEY in .env.local" });
    expect(chatErrorMessage(new Error(body))).toBe("Set ANTHROPIC_API_KEY in .env.local");
  });

  it("shows a short stream error message", () => {
    expect(chatErrorMessage(new Error("anthropic rejected the API key."))).toBe("anthropic rejected the API key.");
  });

  it("falls back to a generic message for anything else", () => {
    expect(chatErrorMessage(new Error(JSON.stringify({ other: 1 })))).toMatch(/Something went wrong/);
    expect(chatErrorMessage(new Error("line one\nstack trace"))).toMatch(/Something went wrong/);
    expect(chatErrorMessage(new Error(""))).toMatch(/Something went wrong/);
  });

  it("returns null when there's no error", () => {
    expect(chatErrorMessage(undefined)).toBeNull();
  });
});
