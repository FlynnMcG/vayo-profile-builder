import { TravelProfileSchema, type TravelProfile } from "./schema";

// Temporary seed data until profiles are built by the chat API and persisted.
export const placeholderProfile: TravelProfile = TravelProfileSchema.parse({
  homeAirport: "SFO",
  budget: "moderate",
  seatPreference: "window",
  travelStyle: ["Slow travel", "Food-focused"],
  accommodation: ["Boutique hotels"],
  interests: ["Hiking", "Museums"],
  dietary: [],
  wishlist: ["Japan", "Portugal"],
});
