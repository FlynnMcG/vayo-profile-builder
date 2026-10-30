import { describe, expect, it } from "vitest";
import { emptyProfile } from "@/lib/profile/schema";
import { SAM } from "../../../test/fixtures/profiles";
import { createInMemoryDeps } from "../../../test/helpers/in-memory-deps";
import {
  buildModelMessages,
  createChatTools,
  MessageAlreadyAnsweredError,
  streamChatReply,
} from "./chat-service";

describe("streamChatReply", () => {
  it("rejects a retried message that already has a reply, without calling the model", async () => {
    const deps = createInMemoryDeps();
    await deps.historyStore.appendMessage("c1", { id: "u1", role: "user", content: "Hi" });
    await deps.historyStore.appendMessage("c1", { id: "a1", role: "assistant", content: "Hello!" });

    await expect(
      streamChatReply({ chatId: "c1", message: { id: "u1", role: "user", content: "Hi" } }, deps),
    ).rejects.toThrow(MessageAlreadyAnsweredError);

    expect(await deps.historyStore.getMessages("c1")).toHaveLength(2);
  });
});

describe("buildModelMessages", () => {
  const profile = { ...emptyProfile, name: "Sam" };

  it("adds the current profile to the newest user message only", () => {
    const messages = buildModelMessages(
      [
        { id: "u1", role: "user", content: "Hi" },
        { id: "a1", role: "assistant", content: "Hello!" },
        { id: "u2", role: "user", content: "I'm Sam" },
      ],
      profile,
    );

    expect(messages.slice(0, 2)).toEqual([
      { role: "user", content: "Hi" },
      { role: "assistant", content: "Hello!" },
    ]);
    expect(messages[2].content).toBe(
      `<current_profile>\n${JSON.stringify(profile)}\n</current_profile>\n\nI'm Sam`,
    );
  });

  it("masks travel document numbers in the model context", () => {
    const [message] = buildModelMessages([{ id: "u1", role: "user", content: "Hi" }], SAM);
    expect(message.content).toContain("••••5678");
    expect(message.content).not.toContain("X12345678");
  });

  it("leaves history unchanged when it doesn't end with a user message", () => {
    const history = [{ id: "a1", role: "assistant" as const, content: "Hello!" }];
    expect(buildModelMessages(history, profile)).toEqual([{ role: "assistant", content: "Hello!" }]);
  });
});

describe("createChatTools", () => {
  it("exposes the profile and destination tools", () => {
    expect(Object.keys(createChatTools(createInMemoryDeps())).sort()).toEqual([
      "getDestinationInfo",
      "listDestinations",
      "updateProfile",
    ]);
  });
});
