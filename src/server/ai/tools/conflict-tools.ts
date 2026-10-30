import "server-only";
import { tool } from "ai";
import { z } from "zod";
import {
  redactConflict,
  ReportConflictInputSchema,
  ResolveConflictInputSchema,
} from "@/lib/conflicts/schema";
import { ListProfileChangeSchema } from "@/lib/profile/changes";
import { redactProfile } from "@/lib/profile/redact";
import type { ConflictService, TurnContext } from "@/server/conflicts/conflict-service";

export function createConflictTools(service: ConflictService, turn: TurnContext) {
  return {
    reportConflict: tool({
      description:
        "For list fields only: hold a list change and ask the user about it when it contradicts what's saved (e.g. adding Tokyo to the wishlist when Japan is in avoid). The change is not applied until resolved. Single-value fields and travel documents go through updateProfile, which detects overwrites itself.",
      // Scalars and documents are checked automatically by updateProfile, so
      // the assistant may only report list conflicts.
      inputSchema: ReportConflictInputSchema.extend({
        change: ListProfileChangeSchema.describe("The list change the user seems to want"),
      }),
      execute: async (input) => {
        const outcome = service.reportConflict(input, turn);
        return outcome.ok ? { ...outcome, conflict: redactConflict(outcome.conflict) } : outcome;
      },
    }),
    resolveConflict: tool({
      description:
        "Settle a pending conflict after the user has answered it in a later message: keep_existing, accept_proposed, or custom (a different change for the same field). Can't be used in the same turn the conflict was raised.",
      inputSchema: ResolveConflictInputSchema.extend({
        conflictId: z.string().describe("The id from <pending_conflicts> or the conflict result"),
      }),
      execute: async ({ conflictId, resolution }) => {
        const outcome = service.resolveConflict(conflictId, { resolution }, turn);
        return outcome.ok
          ? { ok: true, profile: redactProfile(outcome.profile), conflict: redactConflict(outcome.conflict) }
          : outcome;
      },
    }),
  };
}
