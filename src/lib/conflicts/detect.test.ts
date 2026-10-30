import { describe, expect, it } from "vitest";
import { emptyProfile, type TravelProfile } from "@/lib/profile/schema";
import { SAM } from "../../../test/fixtures/profiles";
import { conflictKeyFor, detectOverwrites } from "./detect";

describe("detectOverwrites", () => {
  describe("scalar fields", () => {
    it("never conflicts when writing to an empty field", () => {
      const result = detectOverwrites(emptyProfile, [
        { field: "name", value: "Sam" },
        { field: "budgetTier", value: "luxury" },
        { field: "totalBudgetUSD", value: 4000 },
      ]);
      expect(result.conflicts).toEqual([]);
      expect(result.apply).toHaveLength(3);
    });

    it("conflicts when overwriting a different value", () => {
      const result = detectOverwrites(SAM, [{ field: "budgetTier", value: "luxury" }]);
      expect(result.apply).toEqual([]);
      expect(result.conflicts).toEqual([
        { key: "budgetTier", field: "budgetTier", existing: "midRange", change: { field: "budgetTier", value: "luxury" } },
      ]);
    });

    it("conflicts when clearing a value", () => {
      const result = detectOverwrites(SAM, [{ field: "homeAirport", value: null }]);
      expect(result.conflicts.map((c) => c.field)).toEqual(["homeAirport"]);
    });

    it("treats the same value as a no-op, after normalizing", () => {
      const result = detectOverwrites(SAM, [
        { field: "homeAirport", value: "sfo" },
        { field: "name", value: " sam " },
        { field: "budgetTier", value: "midRange" },
      ]);
      expect(result).toEqual({ apply: [], conflicts: [], confirmedOverwrites: [] });
    });

    it("applies a userConfirmed overwrite and records it", () => {
      const change = { field: "budgetTier" as const, value: "luxury" as const, userConfirmed: true };
      const result = detectOverwrites(SAM, [change]);
      expect(result.apply).toEqual([change]);
      expect(result.conflicts).toEqual([]);
      expect(result.confirmedOverwrites).toEqual([
        { key: "budgetTier", field: "budgetTier", existing: "midRange", change },
      ]);
    });

    it("checks later changes in a call against earlier ones", () => {
      const result = detectOverwrites(emptyProfile, [
        { field: "name", value: "Sam" },
        { field: "name", value: "Alex" },
      ]);
      expect(result.apply).toEqual([{ field: "name", value: "Sam" }]);
      expect(result.conflicts.map((c) => c.existing)).toEqual(["Sam"]);
    });
  });

  describe("lists", () => {
    it("never auto-detects conflicts for list adds or removes", () => {
      const result = detectOverwrites(SAM, [
        { field: "interests", op: "add", values: ["hiking"] },
        { field: "wishlist", op: "remove", values: ["Lisbon"] },
        { field: "companions", op: "add", values: ["solo"] },
      ]);
      expect(result.conflicts).toEqual([]);
      expect(result.apply).toHaveLength(3);
    });
  });

  describe("travel documents", () => {
    const passport = SAM.travelDocuments[0];
    const globalEntry = { documentName: "Global Entry", documentNumber: "GE1", nameOnDocument: "Sam Lee" };

    it("adds a document with a new name without conflict", () => {
      const result = detectOverwrites(SAM, [{ field: "travelDocuments", op: "add", documents: [globalEntry] }]);
      expect(result.conflicts).toEqual([]);
      expect(result.apply).toHaveLength(1);
    });

    it("conflicts when a saved document's number or name changes", () => {
      for (const changed of [
        { ...passport, documentNumber: "Y87654321" },
        { ...passport, nameOnDocument: "Samuel Lee" },
      ]) {
        const result = detectOverwrites(SAM, [{ field: "travelDocuments", op: "add", documents: [changed] }]);
        expect(result.conflicts).toEqual([
          {
            key: "travelDocuments:passport",
            field: "travelDocuments",
            existing: passport,
            change: { field: "travelDocuments", op: "add", documents: [changed] },
          },
        ]);
      }
    });

    it("treats re-adding an identical document as a no-op", () => {
      const result = detectOverwrites(SAM, [
        { field: "travelDocuments", op: "add", documents: [{ ...passport, documentName: "PASSPORT" }] },
      ]);
      expect(result).toEqual({ apply: [], conflicts: [], confirmedOverwrites: [] });
    });

    it("checks each document in a change separately", () => {
      const result = detectOverwrites(SAM, [
        {
          field: "travelDocuments",
          op: "add",
          documents: [{ ...passport, documentNumber: "Y87654321" }, globalEntry],
        },
      ]);
      expect(result.conflicts.map((c) => c.key)).toEqual(["travelDocuments:passport"]);
      expect(result.apply).toEqual([{ field: "travelDocuments", op: "add", documents: [globalEntry] }]);
    });

    it("never conflicts on removal", () => {
      const profile: TravelProfile = { ...SAM };
      const result = detectOverwrites(profile, [
        { field: "travelDocuments", op: "remove", documents: [{ documentName: "Passport" }] },
      ]);
      expect(result.conflicts).toEqual([]);
    });
  });
});

describe("conflictKeyFor", () => {
  it("keys scalars and lists by field, documents by name", () => {
    expect(conflictKeyFor({ field: "budgetTier", value: "luxury" })).toBe("budgetTier");
    expect(conflictKeyFor({ field: "wishlist", op: "add", values: ["Tokyo"] })).toBe("wishlist");
    expect(
      conflictKeyFor({ field: "travelDocuments", op: "add", documents: [{ documentName: " Global Entry " }] }),
    ).toBe("travelDocuments:global entry");
  });
});
