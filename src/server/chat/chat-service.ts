import "server-only";
import {
  generateId,
  isStepCount,
  streamText,
  toUIMessageStream,
  type ModelMessage,
  type StreamTextEndEvent,
  type ToolSet,
} from "ai";
import type { ChatMessage, ChatRequest } from "@/lib/chat/schema";
import { CHAT_REASONING, chatConfig, getChatModel } from "@/server/ai/config";
import { CHAT_SYSTEM_PROMPT } from "@/server/ai/prompts";
import { createDestinationTools } from "@/server/ai/tools/destination-tools";
import { getDatabase } from "@/server/db/database";
import { createDestinationStore } from "@/server/destinations/destination-store";
import { createChatHistoryStore, type ChatHistoryStore } from "./history-store";

// Caps tool-call round trips per turn so a confused model can't loop forever.
const MAX_STEPS = 5;

// A retried message that already has a reply. Re-running it would send the
// model a history ending in an assistant turn, which providers reject.
export class MessageAlreadyAnsweredError extends Error {
  constructor(messageId: string) {
    super(`Message "${messageId}" has already been answered`);
    this.name = "MessageAlreadyAnsweredError";
  }
}

export interface ChatServiceDeps {
  historyStore: ChatHistoryStore;
  tools: ToolSet;
}

// Production wiring; tests and evals pass their own (e.g. in-memory) deps.
export function getDefaultChatServiceDeps(): ChatServiceDeps {
  const db = getDatabase();
  return {
    historyStore: createChatHistoryStore(db),
    tools: createDestinationTools(createDestinationStore(db)),
  };
}

function toModelMessage({ role, content }: ChatMessage): ModelMessage {
  return { role, content };
}

// Joins the text from every step; `text` alone is only the final step's.
function getReplyText({ content }: StreamTextEndEvent<ToolSet>): string {
  return content
    .flatMap((part) => (part.type === "text" && part.text.trim() ? [part.text.trim()] : []))
    .join("\n\n");
}

// Records the user's message, streams the assistant's reply from the
// server-held history, and stores the reply once it completes.
export async function streamChatReply(
  { chatId, message }: ChatRequest,
  { historyStore, tools }: ChatServiceDeps = getDefaultChatServiceDeps(),
) {
  await historyStore.appendMessage(chatId, message);
  const history = await historyStore.getMessages(chatId);
  if (history.at(-1)?.id !== message.id) throw new MessageAlreadyAnsweredError(message.id);

  // Generated here so the streamed message and the stored one share an ID.
  const assistantMessageId = generateId();

  const result = streamText({
    model: getChatModel(),
    system: CHAT_SYSTEM_PROMPT,
    messages: history.map(toModelMessage),
    tools,
    stopWhen: isStepCount(MAX_STEPS),
    reasoning: CHAT_REASONING,
    maxOutputTokens: chatConfig.maxOutputTokens,
    onEnd: async (event) => {
      const content = getReplyText(event);
      if (!content) return;
      await historyStore.appendMessage(chatId, { id: assistantMessageId, role: "assistant", content });
    },
  });

  // Finish generating (and saving) even if the client disconnects.
  void result.consumeStream();

  return toUIMessageStream({
    stream: result.stream,
    generateMessageId: () => assistantMessageId,
    onError: (error) => {
      console.error("Chat stream failed", { chatId, error });
      return "Sorry, something went wrong generating a reply. Please try again.";
    },
  });
}
