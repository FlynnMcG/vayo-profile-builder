import "server-only";
import { tool } from "ai";
import { z } from "zod";
import type { DestinationInfo, Season } from "@/lib/destinations/schema";
import type { DestinationStore } from "@/server/destinations/destination-store";

export type GetDestinationResult =
  | { found: true; destination: DestinationInfo }
  | { found: false; name: string; availableDestinations: string[] };

export interface DestinationSummary {
  name: string;
  bestSeasons: Season[];
  knownFor: string[];
}

// Plain handlers, kept separate from the tool wrappers so they're easy to test.
export function getDestinationInfo(store: DestinationStore, name: string): GetDestinationResult {
  const destination = store.get(name);
  if (destination) return { found: true, destination };
  // Tell the model what does exist so it can offer an alternative.
  return { found: false, name, availableDestinations: store.list().map((d) => d.name) };
}

export function listDestinations(store: DestinationStore): DestinationSummary[] {
  return store.list().map(({ name, bestSeasons, knownFor }) => ({ name, bestSeasons, knownFor }));
}

// Read-only on purpose: destination data is reference data, so the model can
// look it up but not change it. Write operations stay in the store.
export function createDestinationTools(store: DestinationStore) {
  return {
    getDestinationInfo: tool({
      description:
        "Get details for one destination: best seasons, what it's known for, average daily budget in USD per tier, and visa requirement for US passport holders.",
      inputSchema: z.object({
        name: z.string().min(1).describe('Destination name, e.g. "Tokyo"'),
      }),
      execute: async ({ name }) => getDestinationInfo(store, name),
    }),
    listDestinations: tool({
      description:
        "List all destinations with data available, with their best seasons and what they're known for. Use this to suggest destinations.",
      inputSchema: z.object({}),
      execute: async () => listDestinations(store),
    }),
  };
}

export type DestinationTools = ReturnType<typeof createDestinationTools>;
