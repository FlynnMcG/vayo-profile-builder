import { describe, expect, it } from "vitest";
import { z } from "zod";
import { applyProfileChanges, ProfileChangeSchema } from "./changes";
import { emptyProfile, type TravelProfile } from "./schema";

const profile: TravelProfile = {
  ...emptyProfile,
  interests: ["food", "Hiking"],
  wishlist: ["Tokyo"],
  preferredSeasons: ["fall"],
};

describe("applyProfileChanges", () => {
  it("sets and clears scalar fields", () => {
    const set = applyProfileChanges(emptyProfile, [
      { field: "name", value: "  Sam " },
      { field: "citizenship", value: "us" },
      { field: "budgetTier", value: "luxury" },
    ]);
    expect(set).toMatchObject({ name: "Sam", citizenship: "US", budgetTier: "luxury" });

    const cleared = applyProfileChanges(set, [{ field: "budgetTier", value: null }]);
    expect(cleared.budgetTier).toBeNull();
  });

  it("adds to lists without duplicating existing items (case-insensitive)", () => {
    const next = applyProfileChanges(profile, [
      { field: "interests", op: "add", values: ["hiking", " museums "] },
      { field: "preferredSeasons", op: "add", values: ["fall", "spring"] },
    ]);
    expect(next.interests).toEqual(["food", "Hiking", "museums"]);
    expect(next.preferredSeasons).toEqual(["fall", "spring"]);
  });

  it("removes from lists case-insensitively and ignores missing items", () => {
    const next = applyProfileChanges(profile, [
      { field: "interests", op: "remove", values: ["HIKING", "skiing"] },
      { field: "wishlist", op: "remove", values: ["tokyo"] },
    ]);
    expect(next.interests).toEqual(["food"]);
    expect(next.wishlist).toEqual([]);
  });

  it("applies changes in order", () => {
    const next = applyProfileChanges(profile, [
      { field: "wishlist", op: "add", values: ["Lisbon"] },
      { field: "wishlist", op: "remove", values: ["Lisbon"] },
    ]);
    expect(next.wishlist).toEqual(["Tokyo"]);
  });

  it("does not mutate the input profile", () => {
    const before = structuredClone(profile);
    applyProfileChanges(profile, [{ field: "interests", op: "add", values: ["art"] }]);
    expect(profile).toEqual(before);
  });

  it("rejects a result that fails validation", () => {
    expect(() => applyProfileChanges(emptyProfile, [{ field: "citizenship", value: "1!" }])).toThrow();
  });
});

describe("ProfileChangeSchema", () => {
  it("converts to JSON schema for use as a tool input", () => {
    expect(() => z.toJSONSchema(z.object({ changes: z.array(ProfileChangeSchema) }))).not.toThrow();
  });

  it("rejects list changes without values", () => {
    expect(ProfileChangeSchema.safeParse({ field: "interests", op: "add", values: [] }).success).toBe(false);
  });
});

describe("applyProfileChanges: expanded fields", () => {
  it("sets home airport (uppercased) and total budget", () => {
    const next = applyProfileChanges(emptyProfile, [
      { field: "homeAirport", value: "jfk" },
      { field: "totalBudgetUSD", value: 4500 },
    ]);
    expect(next).toMatchObject({ homeAirport: "JFK", totalBudgetUSD: 4500 });
  });

  it("adds and removes enum and string list items", () => {
    const next = applyProfileChanges(emptyProfile, [
      { field: "companions", op: "add", values: ["partner", "friends"] },
      { field: "preferredClimates", op: "add", values: ["warm"] },
      { field: "idealTripTypes", op: "add", values: ["beach", "road trip"] },
      { field: "avoid", op: "add", values: ["crowds"] },
      { field: "companions", op: "remove", values: ["friends"] },
    ]);
    expect(next).toMatchObject({
      companions: ["partner"],
      preferredClimates: ["warm"],
      idealTripTypes: ["beach", "road trip"],
      avoid: ["crowds"],
    });
  });

  it("rejects an invalid airport code", () => {
    expect(() => applyProfileChanges(emptyProfile, [{ field: "homeAirport", value: "J1K" }])).toThrow();
  });
});

describe("applyProfileChanges: travel documents", () => {
  const passport = { documentName: "Passport", documentNumber: "X12345678", nameOnDocument: "Sam Lee" };
  const irishPassport = { documentName: "Passport", documentNumber: "P99990000", nameOnDocument: "Sam Lee" };
  const globalEntry = { documentName: "Global Entry", documentNumber: "GE1111", nameOnDocument: "Sam Lee" };

  it("adds multiple documents, including two with the same name", () => {
    const next = applyProfileChanges(emptyProfile, [
      { field: "travelDocuments", op: "add", documents: [passport, irishPassport, globalEntry] },
    ]);
    expect(next.travelDocuments).toEqual([passport, irishPassport, globalEntry]);
  });

  it("ignores a document that's already saved", () => {
    const profile = { ...emptyProfile, travelDocuments: [passport] };
    const next = applyProfileChanges(profile, [
      { field: "travelDocuments", op: "add", documents: [{ ...passport, documentName: "passport" }] },
    ]);
    expect(next.travelDocuments).toEqual([passport]);
  });

  it("requires a number and name on document to add", () => {
    expect(() =>
      applyProfileChanges(emptyProfile, [
        { field: "travelDocuments", op: "add", documents: [{ documentName: "Passport" }] },
      ]),
    ).toThrow();
  });

  it("removes by name and last 4 digits when names collide", () => {
    const profile = { ...emptyProfile, travelDocuments: [passport, irishPassport, globalEntry] };
    const next = applyProfileChanges(profile, [
      { field: "travelDocuments", op: "remove", documents: [{ documentName: "passport", documentNumber: "0000" }] },
    ]);
    expect(next.travelDocuments).toEqual([passport, globalEntry]);
  });

  it("removes every document with a name when no number is given", () => {
    const profile = { ...emptyProfile, travelDocuments: [passport, irishPassport, globalEntry] };
    const next = applyProfileChanges(profile, [
      { field: "travelDocuments", op: "remove", documents: [{ documentName: "Passport" }] },
    ]);
    expect(next.travelDocuments).toEqual([globalEntry]);
  });
});
