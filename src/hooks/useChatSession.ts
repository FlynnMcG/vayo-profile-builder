"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useCallback, useMemo } from "react";
import type { ChatMessage } from "@/lib/chat/schema";
import { toChatMessage, toChatRequest } from "@/lib/chat/ui-message";

const WELCOME: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Hi! I'm your travel assistant. Tell me about how you like to travel and I'll build your profile.",
};

// The server owns chat history, so only the newest message is sent.
const transport = new DefaultChatTransport({
  api: "/api/chat",
  prepareSendMessagesRequest: ({ id, messages }) => ({
    body: toChatRequest(id, messages[messages.length - 1]),
  }),
});

// Owns chat state for the UI; components only depend on this hook's shape.
export function useChatSession() {
  const { messages, sendMessage, status, error } = useChat({ transport });

  const chatMessages = useMemo(
    () => [
      WELCOME,
      ...messages
        .map(toChatMessage)
        .filter((message): message is ChatMessage => message !== null && message.content !== ""),
    ],
    [messages],
  );

  const send = useCallback(
    (text: string) => {
      const content = text.trim();
      if (content) void sendMessage({ text: content });
    },
    [sendMessage],
  );

  const isBusy = status === "submitted" || status === "streaming";
  const lastMessage = chatMessages[chatMessages.length - 1];

  return {
    messages: chatMessages,
    sendMessage: send,
    isBusy,
    // Show a typing indicator until the first reply tokens arrive.
    isAwaitingReply: isBusy && lastMessage.role === "user",
    error: error ? "Something went wrong reaching the assistant. Please try again." : null,
  };
}
