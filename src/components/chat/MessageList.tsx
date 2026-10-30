"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage } from "@/lib/chat/schema";

interface MessageListProps {
  messages: ChatMessage[];
  isAwaitingReply?: boolean;
}

export function MessageList({ messages, isAwaitingReply = false }: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isAwaitingReply]);

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6">
      <ul className="mx-auto flex max-w-2xl flex-col gap-4">
        {messages.map((message) => (
          <li
            key={message.id}
            className={message.role === "user" ? "flex justify-end" : "flex justify-start"}
          >
            <div
              className={
                message.role === "user"
                  ? "max-w-[80%] rounded-2xl rounded-br-sm bg-sky-600 px-4 py-2.5 text-white"
                  : "max-w-[80%] rounded-2xl rounded-bl-sm bg-zinc-100 px-4 py-2.5 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
              }
            >
              <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
            </div>
          </li>
        ))}
        {isAwaitingReply && (
          <li className="flex justify-start" aria-live="polite">
            <div className="rounded-2xl rounded-bl-sm bg-zinc-100 px-4 py-2.5 text-sm text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              Thinking…
            </div>
          </li>
        )}
      </ul>
      <div ref={endRef} />
    </div>
  );
}
