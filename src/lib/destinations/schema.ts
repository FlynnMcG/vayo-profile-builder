import { z } from "zod";

export const SeasonSchema = z.enum(["spring", "summer", "fall", "winter"]);

// Entry requirement for US passport holders on a short tourist trip,
// ordered from least to most effort.
export const VisaRequirementSchema = z.enum([
  "none", // visa-free entry
  "eta", // electronic travel authorization (e.g. UK ETA)
  "e_visa", // visa applied for online before travel
  "visa_on_arrival", // visa issued at the border
  "embassy_visa", // visa applied for through an embassy or consulate
]);

export const DailyBudgetSchema = z
  .object({
    budget: z.number().int().positive(),
    midRange: z.number().int().positive(),
    luxury: z.number().int().positive(),
  })
  .refine((b) => b.budget <= b.midRange && b.midRange <= b.luxury, {
    message: "Budget tiers must be in ascending order: budget <= midRange <= luxury",
  });

export const DestinationInfoSchema = z.object({
  name: z.string().trim().min(1).max(100),
  bestSeasons: z
    .array(SeasonSchema)
    .min(1)
    .refine((seasons) => new Set(seasons).size === seasons.length, {
      message: "Seasons must be unique",
    })
    .describe("Northern Hemisphere calendar seasons (spring = Mar–May)"),
  knownFor: z.array(z.string().trim().min(1)).min(1).describe('e.g. ["food", "architecture"]'),
  averageDailyBudgetUSD: DailyBudgetSchema,
  visaRequirement: VisaRequirementSchema.optional().describe(
    "Entry requirement for US passport holders; omitted when not applicable (domestic)",
  ),
});

// Updates can change anything except the name, which identifies the record.
export const DestinationUpdateSchema = DestinationInfoSchema.omit({ name: true }).partial();

export type Season = z.infer<typeof SeasonSchema>;
export type VisaRequirement = z.infer<typeof VisaRequirementSchema>;
export type DestinationInfo = z.infer<typeof DestinationInfoSchema>;
export type DestinationUpdate = z.infer<typeof DestinationUpdateSchema>;
