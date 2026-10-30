import { z } from "zod";
import { BudgetTierSchema, SeasonSchema } from "@/lib/destinations/schema";
import {
  ClimateSchema,
  CompanionSchema,
  documentKey,
  TravelProfileSchema,
  type ProfileField,
  type TravelDocument,
  type TravelProfile,
} from "./schema";

// A single edit to the profile. Scalars are set (null clears them); lists are
// added to or removed from, so the model never has to resend a whole list.
// Kept free of transforms so it converts cleanly to a tool's JSON schema.
const ListOpSchema = z.enum(["add", "remove"]);
const ChangeStringSchema = z.string().min(1).max(100);

// Lets the model skip conflict detection for an overwrite, only when the
// user's current message explicitly replaces the existing value.
const UserConfirmedSchema = z
  .boolean()
  .optional()
  .describe(
    "Set true only if the user's current message explicitly replaces the existing value (e.g. 'actually, change my budget to luxury'). Skips conflict detection.",
  );

const scalarChange = <F extends ProfileField, V extends z.ZodType>(field: F, value: V) =>
  z.object({ field: z.literal(field), value, userConfirmed: UserConfirmedSchema });

const listChange = <F extends ProfileField, V extends z.ZodType>(field: F, value: V) =>
  z.object({
    field: z.literal(field),
    op: ListOpSchema,
    values: z.array(value).min(1),
    userConfirmed: UserConfirmedSchema,
  });

// For "add", all three fields are required; adding a document whose name is
// already saved replaces it (one document per name). For "remove", only the
// name is needed.
const DocumentChangeItemSchema = z.object({
  documentName: ChangeStringSchema.describe('e.g. "Passport", "Global Entry"'),
  documentNumber: z.string().min(1).max(50).optional(),
  nameOnDocument: ChangeStringSchema.optional(),
});

const LIST_CHANGES = [
  listChange("preferredSeasons", SeasonSchema),
  listChange("preferredClimates", ClimateSchema),
  listChange("companions", CompanionSchema),
  listChange("interests", ChangeStringSchema),
  listChange("idealTripTypes", ChangeStringSchema.describe('e.g. "beach", "city break", "road trip"')),
  listChange("avoid", ChangeStringSchema.describe('Things to avoid, e.g. "crowds", "long flights"')),
  listChange("wishlist", ChangeStringSchema.describe("Destination name")),
] as const;

export const ProfileChangeSchema = z.discriminatedUnion("field", [
  scalarChange("name", ChangeStringSchema.nullable()),
  scalarChange("citizenship", z.string().length(2).nullable().describe('ISO 3166-1 alpha-2 code, e.g. "US"')),
  scalarChange("homeAirport", z.string().length(3).nullable().describe('IATA code, e.g. "SFO"')),
  scalarChange("budgetTier", BudgetTierSchema.nullable()),
  scalarChange(
    "totalBudgetUSD",
    z.number().int().positive().nullable().describe("Whole-trip budget in USD"),
  ),
  ...LIST_CHANGES,
  z.object({
    field: z.literal("travelDocuments"),
    op: ListOpSchema,
    documents: z.array(DocumentChangeItemSchema).min(1),
    userConfirmed: UserConfirmedSchema,
  }),
]);

// Changes to plain list fields only: the ones automatic detection never
// checks, so the assistant reports their conflicts itself.
export const ListProfileChangeSchema = z.discriminatedUnion("field", [...LIST_CHANGES]);

export type ProfileChange = z.infer<typeof ProfileChangeSchema>;
export type ScalarChange = Extract<ProfileChange, { value: unknown }>;
export type ListChange = Extract<ProfileChange, { values: unknown[] }>;
export type DocumentChange = Extract<ProfileChange, { field: "travelDocuments" }>;
export type DocumentChangeItem = z.infer<typeof DocumentChangeItemSchema>;

// The change without its userConfirmed flag, for comparing proposals.
export function stripUserConfirmed(change: ProfileChange): ProfileChange {
  const copy = { ...change };
  delete copy.userConfirmed;
  return copy;
}

export const isScalarChange = (change: ProfileChange): change is ScalarChange => "value" in change;
export const isDocumentChange = (change: ProfileChange): change is DocumentChange =>
  change.field === "travelDocuments";

const sameItem = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

// Normalizes a scalar change's value the way it will be stored.
export function normalizeScalar(change: ScalarChange): TravelProfile[ScalarChange["field"]] {
  if (change.value === null) return null;
  switch (change.field) {
    case "name":
      return change.value.trim();
    case "citizenship":
    case "homeAirport":
      return change.value.trim().toUpperCase();
    default:
      return change.value;
  }
}

export const toDocument = (item: DocumentChangeItem): TravelDocument => ({
  documentName: item.documentName.trim(),
  // Missing number or name fails validation in applyProfileChanges.
  documentNumber: item.documentNumber?.trim() ?? "",
  nameOnDocument: item.nameOnDocument?.trim() ?? "",
});

function applyListOp<T extends string>(current: T[], op: "add" | "remove", values: T[]): T[] {
  if (op === "remove") return current.filter((item) => !values.some((v) => sameItem(item, v)));

  const next = [...current];
  for (const value of values) {
    const trimmed = value.trim() as T;
    if (!next.some((item) => sameItem(item, trimmed))) next.push(trimmed);
  }
  return next;
}

function applyDocumentOp(
  current: TravelDocument[],
  op: "add" | "remove",
  items: DocumentChangeItem[],
): TravelDocument[] {
  const keys = new Set(items.map(documentKey));
  // Both ops drop any saved document with the same name; "add" then appends
  // the new version, so adding acts as an upsert by name.
  const kept = current.filter((doc) => !keys.has(documentKey(doc)));
  return op === "remove" ? kept : [...kept, ...items.map(toDocument)];
}

function applyChange(profile: TravelProfile, change: ProfileChange): TravelProfile {
  if (isScalarChange(change)) return { ...profile, [change.field]: normalizeScalar(change) };
  if (isDocumentChange(change)) {
    return { ...profile, travelDocuments: applyDocumentOp(profile.travelDocuments, change.op, change.documents) };
  }
  return {
    ...profile,
    [change.field]: applyListOp<string>(profile[change.field], change.op, change.values),
  };
}

// Applies changes in order and validates the result. Pure and unconditional;
// conflict detection decides which changes reach this.
export function applyProfileChanges(profile: TravelProfile, changes: ProfileChange[]): TravelProfile {
  return TravelProfileSchema.parse(changes.reduce(applyChange, profile));
}
