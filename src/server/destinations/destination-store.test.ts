import { beforeEach, describe, expect, it } from "vitest";
import type { DestinationInfo } from "@/lib/destinations/schema";
import { openDatabase, openSeededDatabase } from "@/server/db/database";
import {
  createDestinationStore,
  DestinationExistsError,
  seedDestinations,
  type DestinationStore,
} from "./destination-store";
import { SEED_DESTINATIONS } from "./seed-data";

const kyoto: DestinationInfo = {
  name: "Kyoto",
  bestSeasons: ["spring", "fall"],
  knownFor: ["temples", "gardens"],
  averageDailyBudgetUSD: { budget: 80, midRange: 200, luxury: 550 },
  visaRequirement: "none",
};

describe("destination store", () => {
  let store: DestinationStore;

  beforeEach(() => {
    store = createDestinationStore(openDatabase());
  });

  describe("create / get", () => {
    it("round-trips a destination", () => {
      expect(store.create(kyoto)).toEqual(kyoto);
      expect(store.get("Kyoto")).toEqual(kyoto);
    });

    it("round-trips a destination without a visa requirement", () => {
      const domestic: DestinationInfo = { ...kyoto };
      delete domestic.visaRequirement;
      store.create(domestic);
      expect(store.get("Kyoto")).toEqual(domestic);
      expect(store.get("Kyoto")).not.toHaveProperty("visaRequirement");
    });

    it("matches names case-insensitively and ignores surrounding whitespace", () => {
      store.create(kyoto);
      expect(store.get("  kYOTO ")?.name).toBe("Kyoto");
    });

    it("returns null for an unknown destination", () => {
      expect(store.get("Atlantis")).toBeNull();
    });

    it("rejects duplicate names regardless of case", () => {
      store.create(kyoto);
      expect(() => store.create({ ...kyoto, name: "KYOTO" })).toThrow(DestinationExistsError);
    });

    it("rejects invalid data before writing", () => {
      expect(() => store.create({ ...kyoto, knownFor: [] })).toThrow();
      expect(store.list()).toEqual([]);
    });
  });

  describe("list", () => {
    it("returns an empty list for an empty database", () => {
      expect(store.list()).toEqual([]);
    });

    it("returns destinations sorted by name", () => {
      store.create(kyoto);
      store.create({ ...kyoto, name: "Amsterdam" });
      expect(store.list().map((d) => d.name)).toEqual(["Amsterdam", "Kyoto"]);
    });
  });

  describe("update", () => {
    beforeEach(() => {
      store.create(kyoto);
    });

    it("applies a partial update and keeps other fields", () => {
      const updated = store.update("kyoto", { knownFor: ["temples", "tea"] });
      expect(updated).toEqual({ ...kyoto, knownFor: ["temples", "tea"] });
      expect(store.get("Kyoto")).toEqual(updated);
    });

    it("can clear the visa requirement", () => {
      const updated = store.update("Kyoto", { visaRequirement: undefined });
      expect(updated).not.toHaveProperty("visaRequirement");
      expect(store.get("Kyoto")).not.toHaveProperty("visaRequirement");
    });

    it("validates the merged record", () => {
      expect(() =>
        store.update("Kyoto", { averageDailyBudgetUSD: { budget: 900, midRange: 200, luxury: 550 } }),
      ).toThrow();
      expect(store.get("Kyoto")).toEqual(kyoto);
    });

    it("returns null for an unknown destination", () => {
      expect(store.update("Atlantis", { knownFor: ["myths"] })).toBeNull();
    });
  });

  describe("delete", () => {
    it("removes a destination", () => {
      store.create(kyoto);
      expect(store.delete("KYOTO")).toBe(true);
      expect(store.get("Kyoto")).toBeNull();
    });

    it("returns false for an unknown destination", () => {
      expect(store.delete("Atlantis")).toBe(false);
    });
  });
});

describe("seed data", () => {
  it("has 10 destinations with unique names", () => {
    const names = SEED_DESTINATIONS.map((d) => d.name.toLowerCase());
    expect(names).toHaveLength(10);
    expect(new Set(names).size).toBe(10);
  });

  it("covers every season and a range of visa requirements", () => {
    const seasons = new Set(SEED_DESTINATIONS.flatMap((d) => d.bestSeasons));
    expect(seasons).toEqual(new Set(["spring", "summer", "fall", "winter"]));

    const visas = new Set(SEED_DESTINATIONS.map((d) => d.visaRequirement));
    expect(visas.size).toBeGreaterThanOrEqual(4);
    expect(visas).toContain(undefined);
  });

  it("loads into a seeded database", () => {
    const store = createDestinationStore(openSeededDatabase());
    expect(store.list()).toHaveLength(10);
    expect(store.get("Tokyo")).toEqual(SEED_DESTINATIONS.find((d) => d.name === "Tokyo"));
  });

  it("is idempotent", () => {
    const store = createDestinationStore(openDatabase());
    seedDestinations(store, SEED_DESTINATIONS);
    seedDestinations(store, SEED_DESTINATIONS);
    expect(store.list()).toHaveLength(10);
  });
});
