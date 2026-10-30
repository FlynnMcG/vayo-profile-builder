import "server-only";
import { tool } from "ai";
import { z } from "zod";
import { redactConflict } from "@/lib/conflicts/schema";
import { ProfileChangeSchema } from "@/lib/profile/changes";
import { redactChange, redactProfile } from "@/lib/profile/redact";
import type { ConflictService, TurnContext, UpdateProfileOutcome } from "@/server/conflicts/conflict-service";

// Masks document numbers in everything the model sees.
export function redactUpdateOutcome(outcome: UpdateProfileOutcome): UpdateProfileOutcome {
  if (!outcome.ok) return { ...outcome, profile: redactProfile(outcome.profile) };
  return {
    ...outcome,
    profile: redactProfile(outcome.profile),
    applied: outcome.applied.map(redactChange),
    conflicts: outcome.conflicts.map(redactConflict),
    rejected: outcome.rejected.map(({ reason, change }) => ({ reason, change: redactChange(change) })),
  };
}

export function createProfileTools(service: ConflictService, turn: TurnContext) {
  return {
    updateProfile: tool({
      description:
        "Save travel preferences the user has stated to their profile. Single-value fields are set (null clears them); list fields and travelDocuments use add/remove. Changes that would overwrite an existing value come back as conflicts instead of being applied, unless userConfirmed is set. Only record what the user actually said.",
      inputSchema: z.object({ changes: z.array(ProfileChangeSchema).min(1) }),
      execute: async ({ changes }) => redactUpdateOutcome(service.updateProfile(changes, turn)),
    }),
  };
}
