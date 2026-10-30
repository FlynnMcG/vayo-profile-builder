"use client";

import { useChatSession } from "@/hooks/useChatSession";
import { ChatInput } from "./ChatInput";
import { MessageList } from "./MessageList";

export function ChatPanel() {
  const { messages, sendMessage, isBusy, isAwaitingReply, error } = useChatSession();

  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-label="Chat">
      <MessageList messages={messages} isAwaitingReply={isAwaitingReply} />
      {error && (
        <p role="alert" className="px-6 pb-2 text-center text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <ChatInput onSend={sendMessage} disabled={isBusy} />
    </section>
  );
}
