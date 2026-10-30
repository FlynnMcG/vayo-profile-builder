import { describe, expect, it } from "vitest";
import { SAM } from "../../../test/fixtures/profiles";
import { describeConflict } from "./display";
import type { ProfileConflict } from "./schema";

const base: Omit<ProfileConflict, "field" | "existing" | "proposed"> = {
  id: "c1",
  key: "k",
  source: "overwrite",
  reason: null,
  status: "pending",
  resolution: null,
  chatId: null,
  raisedInMessageId: null,
  createdAt: "",
  resolvedAt: null,
};

describe("describeConflict", () => {
  it("formats scalar values with the profile's labels", () => {
    expect(
      describeConflict({
        ...base,
        field: "budgetTier",
        existing: "midRange",
        proposed: { field: "budgetTier", value: "luxury" },
      }),
    ).toEqual({ id: "c1", field: "budgetTier", saved: "Mid-range", proposed: "Luxury", reason: null });
  });

  it("describes list changes as add/remove", () => {
    const summary = describeConflict({
      ...base,
      source: "reported",
      reason: "Japan is in avoid",
      field: "wishlist",
      existing: ["Lisbon"],
      proposed: { field: "wishlist", op: "add", values: ["Tokyo"] },
    });
    expect(summary).toMatchObject({ saved: "Lisbon", proposed: "Add Tokyo", reason: "Japan is in avoid" });
  });

  it("masks travel document numbers on both sides", () => {
    const summary = describeConflict({
      ...base,
      field: "travelDocuments",
      existing: SAM.travelDocuments[0],
      proposed: {
        field: "travelDocuments",
        op: "add",
        documents: [{ ...SAM.travelDocuments[0], documentNumber: "Y87654321" }],
      },
    });
    expect(summary).toMatchObject({ saved: "Passport ••••5678 · Sam Lee", proposed: "Passport ••••4321 · Sam Lee" });
  });

  it("shows clearing a value as Not set", () => {
    expect(
      describeConflict({ ...base, field: "homeAirport", existing: "SFO", proposed: { field: "homeAirport", value: null } }),
    ).toMatchObject({ saved: "SFO", proposed: "Not set" });
  });
});
