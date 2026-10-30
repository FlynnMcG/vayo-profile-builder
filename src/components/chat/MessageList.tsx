"use client";

import { useEffect, useRef } from "react";
import type { ChatMessageView, ToolActivity } from "@/lib/chat/ui-message";

interface MessageListProps {
  messages: ChatMessageView[];
  isAwaitingReply?: boolean;
}

const TOOL_STATUS_STYLES: Record<ToolActivity["status"], string> = {
  running: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-300",
  done: "border-zinc-200 bg-white text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400",
  error: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
};

const TOOL_STATUS_ICONS: Record<ToolActivity["status"], string> = {
  running: "…",
  done: "✓",
  error: "!",
};

function ToolActivityList({ activity }: { activity: ToolActivity[] }) {
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Tool activity">
      {activity.map((item) => (
        <li
          key={item.id}
          className={`rounded-full border px-2.5 py-0.5 text-xs ${TOOL_STATUS_STYLES[item.status]}`}
        >
          <span aria-hidden="true">{TOOL_STATUS_ICONS[item.status]} </span>
          {item.label}
        </li>
      ))}
    </ul>
  );
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
            className={
              message.role === "user"
                ? "flex flex-col items-end gap-1.5"
                : "flex flex-col items-start gap-1.5"
            }
          >
            {message.toolActivity.length > 0 && <ToolActivityList activity={message.toolActivity} />}
            {message.content && (
              <div
                className={
                  message.role === "user"
                    ? "max-w-[80%] rounded-2xl rounded-br-sm bg-sky-600 px-4 py-2.5 text-white"
                    : "max-w-[80%] rounded-2xl rounded-bl-sm bg-zinc-100 px-4 py-2.5 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                }
              >
                <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
              </div>
            )}
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
