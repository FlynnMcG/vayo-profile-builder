import "server-only";
import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import { conflictKeyFor, detectOverwrites, type DetectedOverwrite } from "@/lib/conflicts/detect";
import {
  ReportConflictInputSchema,
  ResolveConflictInputSchema,
  type ProfileConflict,
  type ReportConflictInput,
  type ResolveConflictInput,
} from "@/lib/conflicts/schema";
import {
  applyProfileChanges,
  isDocumentChange,
  ProfileChangeSchema,
  stripUserConfirmed,
  type ProfileChange,
} from "@/lib/profile/changes";
import { documentKey, emptyProfile, type TravelProfile } from "@/lib/profile/schema";
import { withTransaction } from "@/server/db/transaction";
import type { ProfileStore } from "@/server/profile/profile-store";
import type { ConflictStore, NewConflict } from "./conflict-store";

// The chat turn a call happens in, identified by the user's message.
// Calls from the HTTP API have no turn.
export interface TurnContext {
  chatId: string;
  userMessageId: string;
}

export interface RejectedChange {
  change: ProfileChange;
  reason: string;
}

export type UpdateProfileOutcome =
  | {
      ok: true;
      profile: TravelProfile;
      applied: ProfileChange[];
      conflicts: ProfileConflict[];
      rejected: RejectedChange[];
    }
  | { ok: false; error: string; profile: TravelProfile };

export type ConflictErrorCode = "invalid" | "not_found" | "not_pending" | "same_turn" | "stale";

export type ResolveOutcome =
  | { ok: true; profile: TravelProfile; conflict: ProfileConflict }
  | { ok: false; code: ConflictErrorCode; error: string };

export type ReportOutcome =
  | { ok: true; conflict: ProfileConflict }
  | { ok: false; code: ConflictErrorCode; error: string };

// Owns every write to the profile, so conflict rules can't be bypassed.
export interface ConflictService {
  getProfile(): TravelProfile;
  listPending(): ProfileConflict[];
  updateProfile(changes: ProfileChange[], turn?: TurnContext): UpdateProfileOutcome;
  reportConflict(input: ReportConflictInput, turn?: TurnContext): ReportOutcome;
  resolveConflict(id: string, input: ResolveConflictInput, turn?: TurnContext): ResolveOutcome;
  resetProfile(): void;
}

interface ConflictServiceDeps {
  db: DatabaseSync;
  profileStore: ProfileStore;
  conflictStore: ConflictStore;
}

const errorMessage = (error: unknown) => (error instanceof z.ZodError ? z.prettifyError(error) : String(error));

// Splits document changes into one change per document, so each has its
// own conflict key.
function splitDocumentChanges(changes: ProfileChange[]): ProfileChange[] {
  return changes.flatMap((change) =>
    isDocumentChange(change) && change.documents.length > 1
      ? change.documents.map((doc) => ({ ...change, documents: [doc] }))
      : [change],
  );
}

// The current value a change would affect, snapshotted on the conflict.
function currentValueFor(profile: TravelProfile, change: ProfileChange): unknown {
  if (isDocumentChange(change)) {
    return profile.travelDocuments.find((doc) => documentKey(doc) === documentKey(change.documents[0])) ?? null;
  }
  return profile[change.field];
}

// Compares proposals ignoring the userConfirmed flag and letter case.
const sameProposal = (a: ProfileChange, b: ProfileChange) =>
  JSON.stringify(stripUserConfirmed(a)).toLowerCase() === JSON.stringify(stripUserConfirmed(b)).toLowerCase();

export function createConflictService({ db, profileStore, conflictStore }: ConflictServiceDeps): ConflictService {
  const getProfile = () => profileStore.get() ?? emptyProfile;

  const raisedThisTurn = (conflict: ProfileConflict | null, turn?: TurnContext) =>
    !!conflict && !!turn && conflict.raisedInMessageId === turn.userMessageId;

  // Creates a pending conflict, applying the dedupe/replace rules:
  // identical pending conflict -> reuse it; different one on the key -> supersede it.
  const raise = (conflict: NewConflict): ProfileConflict => {
    const pending = conflictStore.findPendingByKey(conflict.key);
    if (pending) {
      const identical =
        sameProposal(pending.proposed, conflict.proposed) &&
        JSON.stringify(pending.existing) === JSON.stringify(conflict.existing ?? null);
      if (identical) return pending;
      conflictStore.markSuperseded(pending.id);
    }
    return conflictStore.insertPending(conflict);
  };

  const toNewConflict = (
    detected: Pick<DetectedOverwrite, "key" | "field" | "existing" | "change">,
    source: NewConflict["source"],
    reason: string | null,
    turn?: TurnContext,
  ): NewConflict => ({
    key: detected.key,
    field: detected.field,
    source,
    existing: detected.existing,
    proposed: detected.change,
    reason,
    chatId: turn?.chatId ?? null,
    raisedInMessageId: turn?.userMessageId ?? null,
  });

  return {
    getProfile,

    listPending: () => conflictStore.listPending(),

    updateProfile(rawChanges, turn) {
      const parsed = z.array(ProfileChangeSchema).safeParse(rawChanges);
      if (!parsed.success) return { ok: false, error: z.prettifyError(parsed.error), profile: getProfile() };

      try {
        return withTransaction(db, () => {
          const current = getProfile();
          const rejected: RejectedChange[] = [];

          // A key whose conflict was raised this turn waits for the user's
          // reply; nothing (not even userConfirmed) may change it yet.
          const allowed = splitDocumentChanges(parsed.data).filter((change) => {
            const blocked = raisedThisTurn(conflictStore.findPendingByKey(conflictKeyFor(change)), turn);
            if (blocked) {
              rejected.push({ change, reason: "A conflict on this field was raised this turn; wait for the user's reply." });
            }
            return !blocked;
          });

          const detection = detectOverwrites(current, allowed);
          const profile = profileStore.update(applyProfileChanges(current, detection.apply));

          // Held changes must be valid too, or accepting them later would fail.
          // Throwing rolls back the whole call.
          for (const { change } of detection.conflicts) applyProfileChanges(current, [change]);

          // Confirmed overwrites are recorded for audit and settle any pending
          // conflict on the same key.
          for (const overwrite of detection.confirmedOverwrites) {
            const pending = conflictStore.findPendingByKey(overwrite.key);
            if (pending) conflictStore.markSuperseded(pending.id);
            conflictStore.insertConfirmed(toNewConflict(overwrite, "overwrite", null, turn), turn?.userMessageId ?? null);
          }

          // Setting a scalar or document directly also settles a pending
          // overwrite conflict on it, since the old snapshot no longer
          // applies. List edits leave reported list conflicts alone.
          for (const change of detection.apply) {
            if ("values" in change) continue;
            const pending = conflictStore.findPendingByKey(conflictKeyFor(change));
            if (pending && pending.source === "overwrite") conflictStore.markSuperseded(pending.id);
          }

          const conflicts = detection.conflicts.map((detected) =>
            raise(toNewConflict(detected, "overwrite", null, turn)),
          );

          return { ok: true as const, profile, applied: detection.apply, conflicts, rejected };
        });
      } catch (error) {
        // Report validation problems back instead of failing the turn.
        return { ok: false, error: errorMessage(error), profile: getProfile() };
      }
    },

    reportConflict(input, turn) {
      const parsed = ReportConflictInputSchema.safeParse(input);
      if (!parsed.success) return { ok: false, code: "invalid", error: z.prettifyError(parsed.error) };

      const [change] = splitDocumentChanges([parsed.data.change]);
      try {
        // A reported change must be applicable, so accepting it later works.
        applyProfileChanges(getProfile(), [change]);
      } catch (error) {
        return { ok: false, code: "invalid", error: errorMessage(error) };
      }
      return withTransaction(db, () => {
        const detected = {
          key: conflictKeyFor(change),
          field: change.field,
          existing: currentValueFor(getProfile(), change),
          change,
        };
        return { ok: true as const, conflict: raise(toNewConflict(detected, "reported", parsed.data.reason, turn)) };
      });
    },

    resolveConflict(id, input, turn) {
      const parsed = ResolveConflictInputSchema.safeParse(input);
      if (!parsed.success) return { ok: false, code: "invalid", error: z.prettifyError(parsed.error) };
      const { resolution } = parsed.data;

      try {
        return withTransaction(db, (): ResolveOutcome => {
          const conflict = conflictStore.get(id);
          if (!conflict) return { ok: false, code: "not_found", error: `No conflict with id "${id}"` };
          if (conflict.status !== "pending") {
            return { ok: false, code: "not_pending", error: `Conflict is already ${conflict.status}` };
          }
          if (raisedThisTurn(conflict, turn)) {
            return {
              ok: false,
              code: "same_turn",
              error: "This conflict was raised this turn. Ask the user and resolve it after they reply.",
            };
          }

          const current = getProfile();
          // For detected overwrites, the value must still be what the user was
          // asked about.
          const now = currentValueFor(current, conflict.proposed);
          if (conflict.source === "overwrite" && JSON.stringify(now) !== JSON.stringify(conflict.existing)) {
            conflictStore.markSuperseded(conflict.id);
            return { ok: false, code: "stale", error: "The field changed since this conflict was raised." };
          }

          if (resolution.type === "custom" && resolution.change.field !== conflict.field) {
            return { ok: false, code: "invalid", error: `A custom resolution must change "${conflict.field}"` };
          }

          const change =
            resolution.type === "accept_proposed"
              ? conflict.proposed
              : resolution.type === "custom"
                ? resolution.change
                : null;
          const profile = change ? profileStore.update(applyProfileChanges(current, [change])) : current;
          const resolved = conflictStore.markResolved(conflict.id, resolution, turn?.userMessageId ?? null);
          return { ok: true, profile, conflict: resolved };
        });
      } catch (error) {
        return { ok: false, code: "invalid", error: errorMessage(error) };
      }
    },

    resetProfile() {
      withTransaction(db, () => {
        profileStore.delete();
        conflictStore.supersedeAllPending();
      });
    },
  };
}
