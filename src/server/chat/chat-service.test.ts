import { describe, expect, it } from "vitest";
import { openDatabase } from "@/server/db/database";
import { MessageAlreadyAnsweredError, streamChatReply } from "./chat-service";
import { createChatHistoryStore } from "./history-store";

describe("streamChatReply", () => {
  it("rejects a retried message that already has a reply, without calling the model", async () => {
    const historyStore = createChatHistoryStore(openDatabase());
    await historyStore.appendMessage("c1", { id: "u1", role: "user", content: "Hi" });
    await historyStore.appendMessage("c1", { id: "a1", role: "assistant", content: "Hello!" });

    await expect(
      streamChatReply(
        { chatId: "c1", message: { id: "u1", role: "user", content: "Hi" } },
        { historyStore, tools: {} },
      ),
    ).rejects.toThrow(MessageAlreadyAnsweredError);

    expect(await historyStore.getMessages("c1")).toHaveLength(2);
  });
});
