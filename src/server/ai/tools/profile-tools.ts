import "server-only";
import { tool } from "ai";
import { z } from "zod";
import { applyProfileChanges, ProfileChangeSchema, type ProfileChange } from "@/lib/profile/changes";
import { redactProfile } from "@/lib/profile/redact";
import { emptyProfile, type TravelProfile } from "@/lib/profile/schema";
import type { ProfileStore } from "@/server/profile/profile-store";

export type UpdateProfileResult =
  | { ok: true; profile: TravelProfile }
  | { ok: false; error: string; profile: TravelProfile };

// Plain handler, kept separate from the tool wrapper so it's easy to test.
// Returned profiles are redacted, since the result goes back to the model.
export function updateProfile(store: ProfileStore, changes: ProfileChange[]): UpdateProfileResult {
  const current = store.get() ?? emptyProfile;
  const result = z.array(ProfileChangeSchema).safeParse(changes);
  if (!result.success) {
    return { ok: false, error: z.prettifyError(result.error), profile: redactProfile(current) };
  }

  try {
    const updated = store.update(applyProfileChanges(current, result.data));
    return { ok: true, profile: redactProfile(updated) };
  } catch (error) {
    // Report validation problems back to the model instead of failing the turn.
    const message = error instanceof z.ZodError ? z.prettifyError(error) : String(error);
    return { ok: false, error: message, profile: redactProfile(current) };
  }
}

export function createProfileTools(store: ProfileStore) {
  return {
    updateProfile: tool({
      description:
        "Save travel preferences the user has stated to their profile. Single-value fields are set (null clears them); list fields and travelDocuments use add/remove. Only record what the user actually said.",
      inputSchema: z.object({ changes: z.array(ProfileChangeSchema).min(1) }),
      execute: async ({ changes }) => updateProfile(store, changes),
    }),
  };
}
