import { z } from "zod";
import { BudgetTierSchema, SeasonSchema } from "@/lib/destinations/schema";
import {
  ClimateSchema,
  CompanionSchema,
  documentKey,
  TravelProfileSchema,
  type TravelDocument,
  type TravelProfile,
} from "./schema";

// A single edit to the profile. Scalars are set (null clears them); lists are
// added to or removed from, so the model never has to resend a whole list.
// Kept free of transforms so it converts cleanly to a tool's JSON schema.
const ListOpSchema = z.enum(["add", "remove"]);
const ChangeStringSchema = z.string().min(1).max(100);

const listChange = <F extends string, V extends z.ZodType>(field: F, value: V) =>
  z.object({ field: z.literal(field), op: ListOpSchema, values: z.array(value).min(1) });

// For "add", all three fields are required. For "remove", documents match by
// name, plus documentNumber when given (matched as a suffix, since the model
// only sees the last 4 digits).
const DocumentChangeItemSchema = z.object({
  documentName: ChangeStringSchema,
  documentNumber: z.string().min(1).max(50).optional(),
  nameOnDocument: ChangeStringSchema.optional(),
});

export const ProfileChangeSchema = z.discriminatedUnion("field", [
  z.object({ field: z.literal("name"), value: ChangeStringSchema.nullable() }),
  z.object({
    field: z.literal("citizenship"),
    value: z.string().length(2).nullable().describe('ISO 3166-1 alpha-2 code, e.g. "US"'),
  }),
  z.object({
    field: z.literal("homeAirport"),
    value: z.string().length(3).nullable().describe('IATA code, e.g. "SFO"'),
  }),
  z.object({ field: z.literal("budgetTier"), value: BudgetTierSchema.nullable() }),
  z.object({
    field: z.literal("totalBudgetUSD"),
    value: z.number().int().positive().nullable().describe("Whole-trip budget in USD"),
  }),
  listChange("preferredSeasons", SeasonSchema),
  listChange("preferredClimates", ClimateSchema),
  listChange("companions", CompanionSchema),
  listChange("interests", ChangeStringSchema),
  listChange("idealTripTypes", ChangeStringSchema.describe('e.g. "beach", "city break", "road trip"')),
  listChange("avoid", ChangeStringSchema.describe('Things to avoid, e.g. "crowds", "long flights"')),
  listChange("wishlist", ChangeStringSchema.describe("Destination name")),
  z.object({
    field: z.literal("travelDocuments"),
    op: ListOpSchema,
    documents: z.array(DocumentChangeItemSchema).min(1),
  }),
]);

export type ProfileChange = z.infer<typeof ProfileChangeSchema>;
type DocumentChangeItem = z.infer<typeof DocumentChangeItemSchema>;

const sameItem = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

function applyListOp<T extends string>(current: T[], op: "add" | "remove", values: T[]): T[] {
  if (op === "remove") return current.filter((item) => !values.some((v) => sameItem(item, v)));

  const next = [...current];
  for (const value of values) {
    const trimmed = value.trim() as T;
    if (!next.some((item) => sameItem(item, trimmed))) next.push(trimmed);
  }
  return next;
}

const matchesDocument = (doc: TravelDocument, match: DocumentChangeItem) =>
  sameItem(doc.documentName, match.documentName) &&
  (!match.documentNumber ||
    doc.documentNumber.toLowerCase().endsWith(match.documentNumber.trim().toLowerCase()));

function applyDocumentOp(
  current: TravelDocument[],
  op: "add" | "remove",
  items: DocumentChangeItem[],
): TravelDocument[] {
  if (op === "remove") return current.filter((doc) => !items.some((item) => matchesDocument(doc, item)));

  const next = [...current];
  for (const item of items) {
    // Missing number or name fails validation in applyProfileChanges.
    const doc = {
      documentName: item.documentName.trim(),
      documentNumber: item.documentNumber?.trim() ?? "",
      nameOnDocument: item.nameOnDocument?.trim() ?? "",
    };
    if (!next.some((existing) => documentKey(existing) === documentKey(doc))) next.push(doc);
  }
  return next;
}

function applyChange(profile: TravelProfile, change: ProfileChange): TravelProfile {
  switch (change.field) {
    case "name":
      return { ...profile, name: change.value?.trim() ?? null };
    case "citizenship":
    case "homeAirport":
      return { ...profile, [change.field]: change.value?.trim().toUpperCase() ?? null };
    case "budgetTier":
    case "totalBudgetUSD":
      return { ...profile, [change.field]: change.value };
    case "travelDocuments":
      return { ...profile, travelDocuments: applyDocumentOp(profile.travelDocuments, change.op, change.documents) };
    default:
      return {
        ...profile,
        [change.field]: applyListOp<string>(profile[change.field], change.op, change.values),
      };
  }
}

// Applies changes in order and validates the result. Pure, so it's easy to
// test and is the natural place for conflict detection to hook in.
export function applyProfileChanges(profile: TravelProfile, changes: ProfileChange[]): TravelProfile {
  return TravelProfileSchema.parse(changes.reduce(applyChange, profile));
}
