import { z } from "zod";
import { ProfileChangeSchema } from "@/lib/profile/changes";
import { redactChange, redactDocument } from "@/lib/profile/redact";
import type { ProfileField } from "@/lib/profile/schema";

export const ConflictStatusSchema = z.enum(["pending", "resolved", "superseded"]);

// "overwrite": detected automatically when a change would replace a value.
// "reported": raised by the assistant (e.g. contradictory list items).
export const ConflictSourceSchema = z.enum(["overwrite", "reported"]);

// How the user settled a conflict. "user_confirmed" is recorded when the
// assistant overwrote a value with userConfirmed, skipping the question.
export const ConflictResolutionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("keep_existing") }),
  z.object({ type: z.literal("accept_proposed") }),
  z.object({
    type: z.literal("custom"),
    change: ProfileChangeSchema.describe("A different change for the same field, as the user answered"),
  }),
  z.object({ type: z.literal("user_confirmed") }),
]);

// What a caller may choose when resolving (user_confirmed is internal).
export const ResolveConflictInputSchema = z.object({
  resolution: z.discriminatedUnion("type", [
    z.object({ type: z.literal("keep_existing") }),
    z.object({ type: z.literal("accept_proposed") }),
    z.object({ type: z.literal("custom"), change: ProfileChangeSchema }),
  ]),
});

export const ReportConflictInputSchema = z.object({
  change: ProfileChangeSchema.describe("The change the user seems to want, held until they confirm"),
  reason: z.string().min(1).max(300).describe("What it contradicts, in a short sentence"),
});

export const ProfileConflictSchema = z.object({
  id: z.string(),
  key: z.string(),
  field: z.string() as z.ZodType<ProfileField>,
  source: ConflictSourceSchema,
  // Snapshot of the value being replaced when the conflict was raised.
  existing: z.unknown(),
  proposed: ProfileChangeSchema,
  reason: z.string().nullable(),
  status: ConflictStatusSchema,
  resolution: ConflictResolutionSchema.nullable(),
  chatId: z.string().nullable(),
  // The user message whose turn raised it; it can't be resolved in that turn.
  raisedInMessageId: z.string().nullable(),
  createdAt: z.string(),
  resolvedAt: z.string().nullable(),
});

export type ConflictStatus = z.infer<typeof ConflictStatusSchema>;
export type ConflictSource = z.infer<typeof ConflictSourceSchema>;
export type ConflictResolution = z.infer<typeof ConflictResolutionSchema>;
export type ResolveConflictInput = z.infer<typeof ResolveConflictInputSchema>;
export type ReportConflictInput = z.infer<typeof ReportConflictInputSchema>;
export type ProfileConflict = z.infer<typeof ProfileConflictSchema>;

// Masks any travel document numbers in a conflict before it leaves the server.
export function redactConflict(conflict: ProfileConflict): ProfileConflict {
  const existing = conflict.existing;
  const isDocument = (value: unknown): value is { documentNumber: string } =>
    !!value && typeof value === "object" && typeof (value as { documentNumber?: unknown }).documentNumber === "string";
  const resolution =
    conflict.resolution?.type === "custom"
      ? { ...conflict.resolution, change: redactChange(conflict.resolution.change) }
      : conflict.resolution;

  return {
    ...conflict,
    existing: isDocument(existing) ? redactDocument(existing) : existing,
    proposed: redactChange(conflict.proposed),
    resolution,
  };
}
