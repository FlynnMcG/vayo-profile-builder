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
  it("keeps only the reply after the last tool call", () => {
    expect(getMessageText(assistantWithTool)).toBe("Tokyo is best in spring.");
  });

  it("joins multiple text parts after the tools as paragraphs", () => {
    const message: UIMessage = {
      ...assistantWithTool,
      parts: [...assistantWithTool.parts, { type: "text", text: "Want details?" }],
    };
    expect(getMessageText(message)).toBe("Tokyo is best in spring.\n\nWant details?");
  });

  it("falls back to all text when nothing follows the tools", () => {
    const message: UIMessage = { ...assistantWithTool, parts: assistantWithTool.parts.slice(0, 2) };
    expect(getMessageText(message)).toBe("Let me check.");
  });

  it("returns plain text messages unchanged", () => {
    expect(getMessageText({ id: "a", role: "assistant", parts: [{ type: "text", text: "Hi" }] })).toBe("Hi");
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

describe("finishedProfileToolCalls", () => {
  it("lists finished profile and conflict tool calls only", async () => {
    const { finishedProfileToolCalls } = await import("./ui-message");
    const messages: UIMessage[] = [
      assistantWithTool,
      {
        id: "a2",
        role: "assistant",
        parts: [
          { type: "tool-updateProfile", toolCallId: "p1", state: "output-available", input: {}, output: {} },
          { type: "tool-resolveConflict", toolCallId: "p2", state: "input-available", input: {} },
          { type: "tool-reportConflict", toolCallId: "p3", state: "output-available", input: {}, output: {} },
        ],
      },
    ];
    expect(finishedProfileToolCalls(messages)).toEqual(["p1", "p3"]);
  });
});
