import "server-only";
import { redactConflict, type ProfileConflict } from "@/lib/conflicts/schema";
import { stripUserConfirmed } from "@/lib/profile/changes";
import { redactProfile } from "@/lib/profile/redact";
import type { TravelProfile } from "@/lib/profile/schema";

// The parts of a pending conflict the model needs to ask about and resolve it.
const summarizeConflict = (conflict: ProfileConflict) => {
  const { id, field, existing, proposed, reason } = redactConflict(conflict);
  return { id, field, saved: existing, proposed: stripUserConfirmed(proposed), ...(reason && { reason }) };
};

// Prefixes the newest user message with the current profile and pending
// conflicts (document numbers masked), so the model sees fresh state each
// turn while the system prompt stays static.
export function formatUserTurn(
  profile: TravelProfile,
  pendingConflicts: ProfileConflict[],
  userText: string,
): string {
  return [
    `<current_profile>\n${JSON.stringify(redactProfile(profile))}\n</current_profile>`,
    `<pending_conflicts>\n${JSON.stringify(pendingConflicts.map(summarizeConflict))}\n</pending_conflicts>`,
    userText,
  ].join("\n\n");
}
