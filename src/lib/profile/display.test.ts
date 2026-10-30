import { describe, expect, it } from "vitest";
import { SAM } from "../../../test/fixtures/profiles";
import { changedFields, toDisplayRows } from "./display";
import { redactProfile } from "./redact";
import { emptyProfile } from "./schema";

describe("toDisplayRows", () => {
  it("formats every field in display order", () => {
    expect(toDisplayRows({ ...SAM, citizenship: "CA" })).toEqual([
      { field: "name", label: "Name", values: ["Sam"] },
      { field: "citizenship", label: "Citizenship", values: ["Canada"] },
      { field: "homeAirport", label: "Home airport", values: ["SFO"] },
      { field: "budgetTier", label: "Budget", values: ["Mid-range"] },
      { field: "totalBudgetUSD", label: "Total trip budget", values: ["$3,000"] },
      { field: "companions", label: "Travels with", values: ["Partner"] },
      { field: "preferredSeasons", label: "Preferred seasons", values: ["Spring", "Fall"] },
      { field: "preferredClimates", label: "Preferred climates", values: ["Mild", "Warm"] },
      { field: "interests", label: "Interests", values: ["food", "architecture"] },
      { field: "idealTripTypes", label: "Ideal trips", values: ["city break"] },
      { field: "avoid", label: "Avoid", values: ["crowds"] },
      { field: "wishlist", label: "Wishlist", values: ["Lisbon"] },
      { field: "travelDocuments", label: "Travel documents", values: ["Passport ••••5678 · Sam Lee"] },
    ]);
  });

  it("masks document numbers whether or not the profile was redacted", () => {
    const fromRaw = toDisplayRows(SAM).find((r) => r.field === "travelDocuments");
    const fromRedacted = toDisplayRows(redactProfile(SAM)).find((r) => r.field === "travelDocuments");
    expect(fromRaw).toEqual(fromRedacted);
    expect(JSON.stringify(fromRaw)).not.toContain("X12345678");
  });

  it("shows unset fields as empty", () => {
    expect(toDisplayRows(emptyProfile).every((row) => row.values.length === 0)).toBe(true);
  });
});

describe("changedFields", () => {
  it("lists fields whose values differ", () => {
    expect(changedFields(SAM, { ...SAM, budgetTier: "luxury", avoid: [] })).toEqual(["budgetTier", "avoid"]);
  });

  it("returns nothing for identical profiles", () => {
    expect(changedFields(SAM, structuredClone(SAM))).toEqual([]);
  });
});
