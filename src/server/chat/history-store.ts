import "server-only";
import type { ChatMessage } from "@/lib/chat/schema";

// Storage boundary for chat history. The in-memory version is temporary;
// a SQLite implementation will replace it without touching callers.
export interface ChatHistoryStore {
  getMessages(chatId: string): Promise<ChatMessage[]>;
  appendMessage(chatId: string, message: ChatMessage): Promise<void>;
}

class InMemoryChatHistoryStore implements ChatHistoryStore {
  private chats = new Map<string, ChatMessage[]>();

  async getMessages(chatId: string): Promise<ChatMessage[]> {
    return [...(this.chats.get(chatId) ?? [])];
  }

  async appendMessage(chatId: string, message: ChatMessage): Promise<void> {
    const messages = this.chats.get(chatId) ?? [];
    // Ignore retries of a message we already have.
    if (messages.some((existing) => existing.id === message.id)) return;
    this.chats.set(chatId, [...messages, message]);
  }
}

// Keep one instance across dev hot reloads.
const globalStore = globalThis as typeof globalThis & {
  chatHistoryStore?: ChatHistoryStore;
};

export const chatHistoryStore: ChatHistoryStore =
  globalStore.chatHistoryStore ?? (globalStore.chatHistoryStore = new InMemoryChatHistoryStore());
