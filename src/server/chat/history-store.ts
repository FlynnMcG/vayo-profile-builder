import "server-only";
import type { DatabaseSync } from "node:sqlite";
import { ChatMessageSchema, type ChatMessage } from "@/lib/chat/schema";

// Storage boundary for chat history, so callers don't depend on SQLite.
export interface ChatHistoryStore {
  // Returns the chat's messages in order, purging any blank ones first.
  getMessages(chatId: string): Promise<ChatMessage[]>;
  appendMessage(chatId: string, message: ChatMessage): Promise<void>;
  // Removes every message in the chat; returns how many were deleted.
  deleteChat(chatId: string): Promise<number>;
}

export function createChatHistoryStore(db: DatabaseSync): ChatHistoryStore {
  const selectMessages = db.prepare(
    "SELECT id, role, content FROM chat_messages WHERE chat_id = ? ORDER BY seq",
  );
  // Ignore retries of a message we already have.
  const insertMessage = db.prepare(
    `INSERT INTO chat_messages (chat_id, id, role, content)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (chat_id, id) DO NOTHING`,
  );
  // Writes are validated, but blank rows can still come from interrupted
  // requests or older code; providers reject empty turns, so drop them.
  const purgeBlankMessages = db.prepare(
    `DELETE FROM chat_messages
     WHERE chat_id = ? AND trim(content, char(32, 9, 10, 13)) = ''`,
  );
  const deleteMessages = db.prepare("DELETE FROM chat_messages WHERE chat_id = ?");

  return {
    async getMessages(chatId) {
      purgeBlankMessages.run(chatId);
      return selectMessages.all(chatId).map((row) => ChatMessageSchema.parse(row));
    },

    async appendMessage(chatId, message) {
      const { id, role, content } = ChatMessageSchema.parse(message);
      insertMessage.run(chatId, id, role, content);
    },

    async deleteChat(chatId) {
      return Number(deleteMessages.run(chatId).changes);
    },
  };
}
