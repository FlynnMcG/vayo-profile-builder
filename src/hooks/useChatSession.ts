"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { chatErrorMessage } from "@/lib/chat/errors";
import {
  finishedProfileToolCalls,
  toChatMessageView,
  toChatRequest,
  type ChatMessageView,
} from "@/lib/chat/ui-message";

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

interface UseChatSessionOptions {
  // Called when the profile may have changed: as each profile tool result
  // arrives mid-turn, and again when the reply finishes.
  onProfileMayHaveChanged?: () => void;
}

// Owns chat state for the UI; components only depend on this hook's shape.
export function useChatSession({ onProfileMayHaveChanged }: UseChatSessionOptions = {}) {
  const { messages, sendMessage, status, error } = useChat({
    transport,
    onFinish: () => onProfileMayHaveChanged?.(),
  });

  // Refresh as soon as a profile tool finishes, without waiting for the
  // rest of the reply to stream.
  const seenToolCalls = useRef(new Set<string>());
  useEffect(() => {
    const fresh = finishedProfileToolCalls(messages).filter((id) => !seenToolCalls.current.has(id));
    if (fresh.length === 0) return;
    fresh.forEach((id) => seenToolCalls.current.add(id));
    onProfileMayHaveChanged?.();
  }, [messages, onProfileMayHaveChanged]);

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
    error: chatErrorMessage(error),
  };
}
