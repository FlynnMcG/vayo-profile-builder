import { z } from "zod";

// Single source of truth for the travel profile shape. The chat API will
// reuse this schema to validate profile updates proposed by the model.
export const BudgetSchema = z.enum(["budget", "moderate", "luxury"]);
export const SeatPreferenceSchema = z.enum(["window", "aisle", "no_preference"]);

export const TravelProfileSchema = z.object({
  homeAirport: z.string().nullable(),
  budget: BudgetSchema.nullable(),
  seatPreference: SeatPreferenceSchema.nullable(),
  travelStyle: z.array(z.string()),
  accommodation: z.array(z.string()),
  interests: z.array(z.string()),
  dietary: z.array(z.string()),
  wishlist: z.array(z.string()),
});

export type TravelProfile = z.infer<typeof TravelProfileSchema>;
export type ProfileField = keyof TravelProfile;

export const emptyProfile: TravelProfile = {
  homeAirport: null,
  budget: null,
  seatPreference: null,
  travelStyle: [],
  accommodation: [],
  interests: [],
  dietary: [],
  wishlist: [],
};
