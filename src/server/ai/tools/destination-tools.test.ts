import { beforeEach, describe, expect, it } from "vitest";
import { openSeededDatabase } from "@/server/db/database";
import { createDestinationStore, type DestinationStore } from "@/server/destinations/destination-store";
import { SEED_DESTINATIONS } from "@/server/destinations/seed-data";
import { getDestinationInfo, listDestinations } from "./destination-tools";

describe("destination tools", () => {
  let store: DestinationStore;

  beforeEach(() => {
    store = createDestinationStore(openSeededDatabase());
  });

  describe("getDestinationInfo", () => {
    it("returns the destination when found", () => {
      expect(getDestinationInfo(store, "lisbon")).toEqual({
        found: true,
        destination: SEED_DESTINATIONS.find((d) => d.name === "Lisbon"),
      });
    });

    it("returns available destinations when not found", () => {
      const result = getDestinationInfo(store, "Atlantis");
      expect(result).toMatchObject({ found: false, name: "Atlantis" });
      expect(result.found === false && result.availableDestinations).toHaveLength(10);
    });
  });

  describe("listDestinations", () => {
    it("returns a summary of every destination", () => {
      const summaries = listDestinations(store);
      expect(summaries).toHaveLength(10);
      expect(summaries.find((d) => d.name === "Reykjavik")).toEqual({
        name: "Reykjavik",
        bestSeasons: ["summer", "winter"],
        knownFor: ["northern lights", "hot springs", "hiking", "nature"],
      });
    });

    it("omits budget and visa details", () => {
      expect(Object.keys(listDestinations(store)[0]).sort()).toEqual(["bestSeasons", "knownFor", "name"]);
    });
  });
});
