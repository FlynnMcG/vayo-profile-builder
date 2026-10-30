import { describe, expect, it } from "vitest";
import { DestinationInfoSchema, DestinationUpdateSchema, type DestinationInfo } from "./schema";

const valid: DestinationInfo = {
  name: "Tokyo",
  bestSeasons: ["spring", "fall"],
  knownFor: ["food"],
  averageDailyBudgetUSD: { budget: 90, midRange: 220, luxury: 600 },
  visaRequirement: "none",
};

describe("DestinationInfoSchema", () => {
  it("accepts a valid destination", () => {
    expect(DestinationInfoSchema.parse(valid)).toEqual(valid);
  });

  it("allows visaRequirement to be omitted", () => {
    const domestic: DestinationInfo = { ...valid };
    delete domestic.visaRequirement;
    expect(DestinationInfoSchema.safeParse(domestic).success).toBe(true);
  });

  it("trims the name", () => {
    expect(DestinationInfoSchema.parse({ ...valid, name: "  Tokyo " }).name).toBe("Tokyo");
  });

  it.each([
    ["unknown visa requirement", { visaRequirement: "maybe" }],
    ["unknown season", { bestSeasons: ["monsoon"] }],
    ["duplicate seasons", { bestSeasons: ["spring", "spring"] }],
    ["no seasons", { bestSeasons: [] }],
    ["empty knownFor", { knownFor: [] }],
    ["blank name", { name: "   " }],
    ["negative budget", { averageDailyBudgetUSD: { budget: -1, midRange: 2, luxury: 3 } }],
    ["fractional budget", { averageDailyBudgetUSD: { budget: 1.5, midRange: 2, luxury: 3 } }],
    ["tiers out of order", { averageDailyBudgetUSD: { budget: 300, midRange: 200, luxury: 600 } }],
  ])("rejects %s", (_label, override) => {
    expect(DestinationInfoSchema.safeParse({ ...valid, ...override }).success).toBe(false);
  });
});

describe("DestinationUpdateSchema", () => {
  it("accepts partial updates", () => {
    expect(DestinationUpdateSchema.parse({ knownFor: ["sushi"] })).toEqual({ knownFor: ["sushi"] });
  });

  it("strips name changes", () => {
    expect(DestinationUpdateSchema.parse({ name: "Kyoto" })).toEqual({});
  });
});
