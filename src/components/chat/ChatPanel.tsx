"use client";

import { useChatSession } from "@/hooks/useChatSession";
import { ChatInput } from "./ChatInput";
import { MessageList } from "./MessageList";

export function ChatPanel() {
  const { messages, sendMessage, isBusy } = useChatSession();

  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-label="Chat">
      <MessageList messages={messages} />
      <ChatInput onSend={sendMessage} disabled={isBusy} />
    </section>
  );
}
