import { z } from "zod";
import { BudgetTierSchema, SeasonSchema } from "@/lib/destinations/schema";

// The traveler's profile. The core fields mirror DestinationInfo so the two
// can be matched: bestSeasons -> preferredSeasons, knownFor -> interests,
// averageDailyBudgetUSD -> budgetTier, visaRequirement -> citizenship,
// and name -> both the traveler's name and a wishlist of destination names.

export const CountryCodeSchema = z
  .string()
  .regex(/^[A-Z]{2}$/, "Must be an uppercase ISO 3166-1 alpha-2 country code")
  .describe('ISO 3166-1 alpha-2 country code, e.g. "US"');

export const AirportCodeSchema = z
  .string()
  .regex(/^[A-Z]{3}$/, "Must be an uppercase IATA airport code")
  .describe('IATA airport code, e.g. "SFO"');

export const CompanionSchema = z.enum(["solo", "partner", "friends", "family", "group"]);

export const ClimateSchema = z.enum(["hot", "warm", "mild", "cool", "cold"]);

const ProfileStringSchema = z.string().trim().min(1).max(100);

export const TravelDocumentSchema = z.object({
  documentName: ProfileStringSchema.describe('e.g. "Passport", "Global Entry"'),
  documentNumber: z.string().trim().min(1).max(50),
  nameOnDocument: ProfileStringSchema,
});

const uniqueBy = <T>(key: (value: T) => string) => (values: T[]) =>
  new Set(values.map(key)).size === values.length;

const caseInsensitive = (value: string) => value.toLowerCase();

// A document is identified by its name and number together.
export const documentKey = (doc: Pick<TravelDocument, "documentName" | "documentNumber">) =>
  `${doc.documentName.toLowerCase()}|${doc.documentNumber.toLowerCase()}`;

const uniqueStrings = (label: string) =>
  z.array(ProfileStringSchema).refine(uniqueBy(caseInsensitive), `${label} must be unique`);

const uniqueEnums = <T extends string>(schema: z.ZodType<T>, label: string) =>
  z.array(schema).refine(uniqueBy(String), `${label} must be unique`);

export const TravelProfileSchema = z.object({
  name: ProfileStringSchema.nullable(),
  citizenship: CountryCodeSchema.nullable(),
  homeAirport: AirportCodeSchema.nullable(),
  budgetTier: BudgetTierSchema.nullable(),
  totalBudgetUSD: z.number().int().positive().nullable().describe("Whole-trip budget in USD"),
  preferredSeasons: uniqueEnums(SeasonSchema, "Seasons"),
  preferredClimates: uniqueEnums(ClimateSchema, "Climates"),
  companions: uniqueEnums(CompanionSchema, "Companions"),
  interests: uniqueStrings("Interests"),
  idealTripTypes: uniqueStrings("Trip types"),
  avoid: uniqueStrings("Avoid"),
  wishlist: uniqueStrings("Wishlist"),
  travelDocuments: z
    .array(TravelDocumentSchema)
    .refine(uniqueBy(documentKey), "Travel documents must be unique"),
});

// Field-level replacement, used by the REST API.
export const ProfileUpdateSchema = TravelProfileSchema.partial().strict();

export type TravelProfile = z.infer<typeof TravelProfileSchema>;
export type ProfileUpdate = z.infer<typeof ProfileUpdateSchema>;
export type ProfileField = keyof TravelProfile;
export type TravelDocument = z.infer<typeof TravelDocumentSchema>;
export type Companion = z.infer<typeof CompanionSchema>;
export type Climate = z.infer<typeof ClimateSchema>;

export const emptyProfile: TravelProfile = {
  name: null,
  citizenship: null,
  homeAirport: null,
  budgetTier: null,
  totalBudgetUSD: null,
  preferredSeasons: [],
  preferredClimates: [],
  companions: [],
  interests: [],
  idealTripTypes: [],
  avoid: [],
  wishlist: [],
  travelDocuments: [],
};
