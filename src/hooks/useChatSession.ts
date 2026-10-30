"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useCallback, useMemo } from "react";
import { toChatMessageView, toChatRequest, type ChatMessageView } from "@/lib/chat/ui-message";

const WELCOME: ChatMessageView = {
  id: "welcome",
  role: "assistant",
  content:
    "Hi! I'm your travel assistant. Tell me about how you like to travel and I'll build your profile.",
  toolActivity: [],
};

// The server owns chat history, so only the newest message is sent.
const transport = new DefaultChatTransport({
  api: "/api/chat",
  prepareSendMessagesRequest: ({ id, messages }) => ({
    body: toChatRequest(id, messages[messages.length - 1]),
  }),
});

const hasVisibleContent = (message: ChatMessageView | null): message is ChatMessageView =>
  message !== null && (message.content !== "" || message.toolActivity.length > 0);

// Owns chat state for the UI; components only depend on this hook's shape.
export function useChatSession() {
  const { messages, sendMessage, status, error } = useChat({ transport });

  const chatMessages = useMemo(
    () => [WELCOME, ...messages.map(toChatMessageView).filter(hasVisibleContent)],
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
