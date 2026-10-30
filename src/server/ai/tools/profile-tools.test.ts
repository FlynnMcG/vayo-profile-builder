import { beforeEach, describe, expect, it } from "vitest";
import { emptyProfile } from "@/lib/profile/schema";
import { openDatabase } from "@/server/db/database";
import { createProfileStore, type ProfileStore } from "@/server/profile/profile-store";
import { updateProfile } from "./profile-tools";

describe("updateProfile tool", () => {
  let store: ProfileStore;

  beforeEach(() => {
    store = createProfileStore(openDatabase());
  });

  it("applies changes and saves the profile", () => {
    const result = updateProfile(store, [
      { field: "name", value: "Sam" },
      { field: "interests", op: "add", values: ["food"] },
    ]);
    expect(result).toEqual({ ok: true, profile: { ...emptyProfile, name: "Sam", interests: ["food"] } });
    expect(store.get()).toEqual(result.profile);
  });

  it("builds on the saved profile across calls", () => {
    updateProfile(store, [{ field: "interests", op: "add", values: ["food"] }]);
    updateProfile(store, [{ field: "interests", op: "add", values: ["hiking"] }]);
    expect(store.get()?.interests).toEqual(["food", "hiking"]);
  });

  it("reports invalid changes to the model without saving", () => {
    store.update({ name: "Sam" });
    const result = updateProfile(store, [{ field: "citizenship", value: "12" }]);
    expect(result.ok).toBe(false);
    expect(result.profile.name).toBe("Sam");
    expect(store.get()?.citizenship).toBeNull();
  });

  it("rejects malformed change objects", () => {
    const result = updateProfile(store, [{ field: "budgetTier", value: "cheap" }] as never);
    expect(result).toMatchObject({ ok: false });
    expect(store.get()).toBeNull();
  });
});

describe("updateProfile tool: document privacy", () => {
  it("saves the full number but returns it masked to the model", () => {
    const store = createProfileStore(openDatabase());
    const result = updateProfile(store, [
      {
        field: "travelDocuments",
        op: "add",
        documents: [{ documentName: "Passport", documentNumber: "X12345678", nameOnDocument: "Sam Lee" }],
      },
    ]);
    expect(result.profile.travelDocuments[0].documentNumber).toBe("••••5678");
    expect(JSON.stringify(result)).not.toContain("X12345678");
    expect(store.get()?.travelDocuments[0].documentNumber).toBe("X12345678");
  });
});
