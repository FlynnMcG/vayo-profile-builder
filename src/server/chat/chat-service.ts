import "server-only";
import { generateId, streamText, toUIMessageStream, type ModelMessage } from "ai";
import type { ChatMessage, ChatRequest } from "@/lib/chat/schema";
import { CHAT_REASONING, chatConfig, getChatModel } from "@/server/ai/config";
import { CHAT_SYSTEM_PROMPT } from "@/server/ai/prompts";
import { chatHistoryStore, type ChatHistoryStore } from "./history-store";

function toModelMessage({ role, content }: ChatMessage): ModelMessage {
  return { role, content };
}

// Records the user's message, streams the assistant's reply from the
// server-held history, and stores the reply once it completes.
export async function streamChatReply(
  { chatId, message }: ChatRequest,
  store: ChatHistoryStore = chatHistoryStore,
) {
  await store.appendMessage(chatId, message);
  const history = await store.getMessages(chatId);

  // Generated here so the streamed message and the stored one share an ID.
  const assistantMessageId = generateId();

  const result = streamText({
    model: getChatModel(),
    system: CHAT_SYSTEM_PROMPT,
    messages: history.map(toModelMessage),
    reasoning: CHAT_REASONING,
    maxOutputTokens: chatConfig.maxOutputTokens,
    onEnd: async ({ text }) => {
      if (!text.trim()) return;
      await store.appendMessage(chatId, {
        id: assistantMessageId,
        role: "assistant",
        content: text,
      });
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
