import type { UIMessage } from "ai";
import type { ChatMessage, ChatRequest } from "./schema";

// Adapters between the AI SDK's UIMessage (used by useChat) and our own
// ChatMessage schema, so the rest of the app doesn't depend on AI SDK types.

export function getMessageText(message: UIMessage): string {
  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("");
}

export function toChatMessage(message: UIMessage): ChatMessage | null {
  if (message.role === "system") return null;
  return { id: message.id, role: message.role, content: getMessageText(message) };
}

export function toChatRequest(chatId: string, message: UIMessage): ChatRequest {
  return {
    chatId,
    message: { id: message.id, role: "user", content: getMessageText(message) },
  };
}
