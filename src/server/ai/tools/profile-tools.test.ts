import { describe, expect, it } from "vitest";
import { createInMemoryDeps } from "../../../../test/helpers/in-memory-deps";
import { redactUpdateOutcome } from "./profile-tools";

const turn = { chatId: "c1", userMessageId: "u1" };
const passport = { documentName: "Passport", documentNumber: "X12345678", nameOnDocument: "Sam Lee" };

describe("updateProfile tool output", () => {
  it("masks document numbers in the profile, applied changes, and conflicts", () => {
    const { conflictService, profileStore } = createInMemoryDeps();
    const first = conflictService.updateProfile([{ field: "travelDocuments", op: "add", documents: [passport] }], turn);
    const second = conflictService.updateProfile(
      [{ field: "travelDocuments", op: "add", documents: [{ ...passport, documentNumber: "Y87654321" }] }],
      { chatId: "c1", userMessageId: "u2" },
    );

    const outputs = JSON.stringify([redactUpdateOutcome(first), redactUpdateOutcome(second)]);
    expect(outputs).not.toContain("X12345678");
    expect(outputs).not.toContain("Y87654321");
    expect(outputs).toContain("••••5678");
    expect(outputs).toContain("••••4321");
    // The database keeps the full number.
    expect(profileStore.get()?.travelDocuments[0].documentNumber).toBe("X12345678");
  });
});
