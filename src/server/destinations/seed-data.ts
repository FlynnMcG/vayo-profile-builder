import type { DestinationInfo } from "@/lib/destinations/schema";

// Demo reference data. Figures are illustrative estimates, not authoritative
// travel or visa advice.
export const SEED_DESTINATIONS: DestinationInfo[] = [
  {
    name: "Tokyo",
    bestSeasons: ["spring", "fall"],
    knownFor: ["food", "temples", "nightlife", "shopping"],
    averageDailyBudgetUSD: { budget: 90, midRange: 220, luxury: 600 },
    visaRequirement: "none",
  },
  {
    name: "Lisbon",
    bestSeasons: ["spring", "summer", "fall"],
    knownFor: ["food", "architecture", "nightlife", "coastline"],
    averageDailyBudgetUSD: { budget: 70, midRange: 160, luxury: 400 },
    visaRequirement: "none",
  },
  {
    name: "Paris",
    bestSeasons: ["spring", "fall"],
    knownFor: ["art", "food", "architecture", "museums"],
    averageDailyBudgetUSD: { budget: 100, midRange: 250, luxury: 700 },
    visaRequirement: "none",
  },
  {
    name: "London",
    bestSeasons: ["summer"],
    knownFor: ["museums", "theater", "history", "pubs"],
    averageDailyBudgetUSD: { budget: 110, midRange: 260, luxury: 700 },
    visaRequirement: "eta",
  },
  {
    name: "Bali",
    bestSeasons: ["spring", "summer"],
    knownFor: ["beaches", "surfing", "temples", "wellness"],
    averageDailyBudgetUSD: { budget: 40, midRange: 110, luxury: 350 },
    visaRequirement: "visa_on_arrival",
  },
  {
    name: "Marrakech",
    bestSeasons: ["spring", "fall"],
    knownFor: ["markets", "architecture", "food", "desert trips"],
    averageDailyBudgetUSD: { budget: 45, midRange: 120, luxury: 400 },
    visaRequirement: "none",
  },
  {
    name: "Cusco",
    bestSeasons: ["summer"],
    knownFor: ["hiking", "history", "ruins", "mountains"],
    averageDailyBudgetUSD: { budget: 40, midRange: 100, luxury: 300 },
    visaRequirement: "none",
  },
  {
    name: "Hanoi",
    bestSeasons: ["spring", "fall"],
    knownFor: ["street food", "history", "culture", "markets"],
    averageDailyBudgetUSD: { budget: 30, midRange: 80, luxury: 250 },
    visaRequirement: "e_visa",
  },
  {
    name: "New York City",
    bestSeasons: ["spring", "fall", "winter"],
    knownFor: ["food", "museums", "theater", "nightlife"],
    averageDailyBudgetUSD: { budget: 150, midRange: 350, luxury: 900 },
  },
  {
    name: "Reykjavik",
    bestSeasons: ["summer", "winter"],
    knownFor: ["northern lights", "hot springs", "hiking", "nature"],
    averageDailyBudgetUSD: { budget: 120, midRange: 250, luxury: 600 },
    visaRequirement: "none",
  },
];
