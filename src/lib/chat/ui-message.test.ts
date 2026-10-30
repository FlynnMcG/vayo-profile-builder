import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";
import { getMessageText, toChatMessageView, toChatRequest } from "./ui-message";

const assistantWithTool: UIMessage = {
  id: "a1",
  role: "assistant",
  parts: [
    { type: "text", text: "Let me check." },
    {
      type: "tool-getDestinationInfo",
      toolCallId: "call-1",
      state: "output-available",
      input: { name: "Tokyo" },
      output: { found: true },
    },
    { type: "text", text: "Tokyo is best in spring." },
  ],
};

describe("getMessageText", () => {
  it("joins text from separate steps as paragraphs", () => {
    expect(getMessageText(assistantWithTool)).toBe("Let me check.\n\nTokyo is best in spring.");
  });
});

describe("toChatMessageView", () => {
  it("describes tool calls as activity", () => {
    expect(toChatMessageView(assistantWithTool)?.toolActivity).toEqual([
      { id: "call-1", label: "Looked up Tokyo", status: "done" },
    ]);
  });

  it("marks in-flight tool calls as running", () => {
    const view = toChatMessageView({
      id: "a2",
      role: "assistant",
      parts: [{ type: "tool-listDestinations", toolCallId: "call-2", state: "input-available", input: {} }],
    });
    expect(view?.toolActivity).toEqual([{ id: "call-2", label: "Browsed destinations", status: "running" }]);
  });

  it("drops system messages", () => {
    expect(toChatMessageView({ id: "s", role: "system", parts: [] })).toBeNull();
  });
});

describe("toChatRequest", () => {
  it("builds a request from the newest user message", () => {
    const message: UIMessage = { id: "u1", role: "user", parts: [{ type: "text", text: "Hi" }] };
    expect(toChatRequest("chat-1", message)).toEqual({
      chatId: "chat-1",
      message: { id: "u1", role: "user", content: "Hi" },
    });
  });
});
