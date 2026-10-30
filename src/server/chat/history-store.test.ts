import { beforeEach, describe, expect, it } from "vitest";
import { openDatabase, type Database } from "@/server/db/database";
import { createChatHistoryStore, type ChatHistoryStore } from "./history-store";

describe("chat history store", () => {
  let db: Database;
  let store: ChatHistoryStore;

  beforeEach(() => {
    db = openDatabase();
    store = createChatHistoryStore(db);
  });

  // Bypasses the store's validation to simulate rows from an interrupted write.
  const insertRaw = (chatId: string, id: string, role: string, content: string) =>
    db
      .prepare("INSERT INTO chat_messages (chat_id, id, role, content) VALUES (?, ?, ?, ?)")
      .run(chatId, id, role, content);

  describe("blank messages", () => {
    it("purges blank and whitespace-only messages when reading history", async () => {
      await store.appendMessage("c1", { id: "u1", role: "user", content: "Hi" });
      insertRaw("c1", "a1", "assistant", "");
      insertRaw("c1", "a2", "assistant", " \n\t ");
      await store.appendMessage("c1", { id: "u2", role: "user", content: "Hello?" });

      expect(await store.getMessages("c1")).toEqual([
        { id: "u1", role: "user", content: "Hi" },
        { id: "u2", role: "user", content: "Hello?" },
      ]);
      const { n } = db.prepare("SELECT count(*) AS n FROM chat_messages").get() as { n: number };
      expect(n).toBe(2);
    });

    it("only purges the chat being read", async () => {
      insertRaw("other", "a1", "assistant", "");
      await store.getMessages("c1");
      const { n } = db.prepare("SELECT count(*) AS n FROM chat_messages").get() as { n: number };
      expect(n).toBe(1);
    });
  });

  describe("deleteChat", () => {
    it("removes every message in the chat and reports the count", async () => {
      await store.appendMessage("c1", { id: "u1", role: "user", content: "Hi" });
      await store.appendMessage("c1", { id: "a1", role: "assistant", content: "Hello!" });
      expect(await store.deleteChat("c1")).toBe(2);
      expect(await store.getMessages("c1")).toEqual([]);
    });

    it("leaves other chats alone", async () => {
      await store.appendMessage("c1", { id: "u1", role: "user", content: "Hi" });
      await store.appendMessage("c2", { id: "u1", role: "user", content: "Hey" });
      await store.deleteChat("c1");
      expect(await store.getMessages("c2")).toHaveLength(1);
    });

    it("returns 0 for an unknown chat", async () => {
      expect(await store.deleteChat("nope")).toBe(0);
    });
  });

  it("returns an empty history for a new chat", async () => {
    expect(await store.getMessages("new-chat")).toEqual([]);
  });

  it("returns messages in the order they were appended", async () => {
    await store.appendMessage("c1", { id: "b", role: "user", content: "first" });
    await store.appendMessage("c1", { id: "a", role: "assistant", content: "second" });
    expect(await store.getMessages("c1")).toEqual([
      { id: "b", role: "user", content: "first" },
      { id: "a", role: "assistant", content: "second" },
    ]);
  });

  it("keeps chats separate", async () => {
    await store.appendMessage("c1", { id: "m1", role: "user", content: "hi" });
    await store.appendMessage("c2", { id: "m1", role: "user", content: "hello" });
    expect(await store.getMessages("c1")).toEqual([{ id: "m1", role: "user", content: "hi" }]);
    expect(await store.getMessages("c2")).toEqual([{ id: "m1", role: "user", content: "hello" }]);
  });

  it("ignores a retried message with the same id", async () => {
    await store.appendMessage("c1", { id: "m1", role: "user", content: "hi" });
    await store.appendMessage("c1", { id: "m1", role: "user", content: "hi" });
    expect(await store.getMessages("c1")).toHaveLength(1);
  });

  it("rejects invalid messages", async () => {
    await expect(store.appendMessage("c1", { id: "m1", role: "user", content: "  " })).rejects.toThrow();
  });
});
