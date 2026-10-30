"use client";

import { useCallback, useState } from "react";
import type { ChatMessage } from "@/lib/chat/types";

const WELCOME: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Hi! I'm your travel assistant. Tell me about how you like to travel and I'll build your profile.",
};

const PLACEHOLDER_REPLY =
  "The chat API isn't connected yet. Your message was received locally.";

// Owns chat state for the UI. This is the seam where the AI SDK's useChat
// will be swapped in, so components only depend on this hook's return shape.
export function useChatSession() {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);

  const sendMessage = useCallback((text: string) => {
    const content = text.trim();
    if (!content) return;

    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", content },
      { id: crypto.randomUUID(), role: "assistant", content: PLACEHOLDER_REPLY },
    ]);
  }, []);

  return { messages, sendMessage, isBusy: false };
}
