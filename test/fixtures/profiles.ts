import type { TravelProfile } from "@/lib/profile/schema";

// A profile with every field set, for tests (and later evals).
export const SAM: TravelProfile = {
  name: "Sam",
  citizenship: "US",
  homeAirport: "SFO",
  budgetTier: "midRange",
  totalBudgetUSD: 3000,
  preferredSeasons: ["spring", "fall"],
  preferredClimates: ["mild", "warm"],
  companions: ["partner"],
  interests: ["food", "architecture"],
  idealTripTypes: ["city break"],
  avoid: ["crowds"],
  wishlist: ["Lisbon"],
  travelDocuments: [{ documentName: "Passport", documentNumber: "X12345678", nameOnDocument: "Sam Lee" }],
};
