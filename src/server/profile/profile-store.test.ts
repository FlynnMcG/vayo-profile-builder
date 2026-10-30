import { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";
import { emptyProfile } from "@/lib/profile/schema";
import { openDatabase } from "@/server/db/database";
import { migrate } from "@/server/db/migrations";
import { SAM as sam } from "../../../test/fixtures/profiles";
import { createProfileStore, ProfileExistsError, type ProfileStore } from "./profile-store";

describe("profile store", () => {
  let store: ProfileStore;

  beforeEach(() => {
    store = createProfileStore(openDatabase());
  });

  it("returns null before a profile exists", () => {
    expect(store.get()).toBeNull();
  });

  describe("create", () => {
    it("round-trips every field", () => {
      expect(store.create(sam)).toEqual(sam);
      expect(store.get()).toEqual(sam);
    });

    it("allows only one profile", () => {
      store.create(sam);
      expect(() => store.create(emptyProfile)).toThrow(ProfileExistsError);
    });

    it("stores travel document numbers in full", () => {
      store.create(sam);
      expect(store.get()?.travelDocuments[0].documentNumber).toBe("X12345678");
    });

    it.each([
      ["citizenship", { citizenship: "usa" }],
      ["home airport", { homeAirport: "sfo1" }],
      ["total budget", { totalBudgetUSD: -5 }],
      ["companion", { companions: ["pets"] }],
      ["climate", { preferredClimates: ["humid"] }],
      ["duplicate documents", { travelDocuments: [sam.travelDocuments[0], sam.travelDocuments[0]] }],
    ])("rejects an invalid %s", (_label, override) => {
      expect(() => store.create({ ...sam, ...override } as never)).toThrow();
      expect(store.get()).toBeNull();
    });
  });

  describe("update", () => {
    it("creates the profile from empty when none exists", () => {
      expect(store.update({ name: "Sam" })).toEqual({ ...emptyProfile, name: "Sam" });
    });

    it("replaces only the given fields", () => {
      store.create(sam);
      expect(store.update({ budgetTier: "luxury", wishlist: [] })).toEqual({
        ...sam,
        budgetTier: "luxury",
        wishlist: [],
      });
    });

    it("clears nullable fields with null", () => {
      store.create(sam);
      expect(store.update({ citizenship: null }).citizenship).toBeNull();
    });

    it("rejects invalid updates and keeps the saved profile", () => {
      store.create(sam);
      expect(() => store.update({ interests: ["food", "FOOD"] })).toThrow();
      expect(() => store.update({ budgetTier: "cheap" } as never)).toThrow();
      expect(() => store.update({ unknownField: 1 } as never)).toThrow();
      expect(store.get()).toEqual(sam);
    });
  });

  describe("delete", () => {
    it("removes the profile", () => {
      store.create(sam);
      expect(store.delete()).toBe(true);
      expect(store.get()).toBeNull();
    });

    it("returns false when there is no profile", () => {
      expect(store.delete()).toBe(false);
    });
  });
});

describe("profile migration", () => {
  it("upgrades a profile saved before the expanded fields existed", () => {
    // Build the schema as of version 2 and save a profile with the old columns.
    const db = new DatabaseSync(":memory:");
    migrate(db, 2);
    db.exec(`INSERT INTO profile (id, name, citizenship, budget_tier, preferred_seasons, interests, wishlist)
             VALUES (1, 'Sam', 'US', 'luxury', '["fall"]', '["food"]', '["Lisbon"]')`);

    migrate(db);

    expect(createProfileStore(db).get()).toEqual({
      ...emptyProfile,
      name: "Sam",
      citizenship: "US",
      budgetTier: "luxury",
      preferredSeasons: ["fall"],
      interests: ["food"],
      wishlist: ["Lisbon"],
    });
  });
});
