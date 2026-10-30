import {
  applyProfileChanges,
  isDocumentChange,
  isScalarChange,
  normalizeScalar,
  toDocument,
  type DocumentChangeItem,
  type ProfileChange,
} from "@/lib/profile/changes";
import { documentKey, type ProfileField, type TravelDocument, type TravelProfile } from "@/lib/profile/schema";

// Automatic (level 1) conflict detection: a change conflicts when it would
// overwrite an existing, different value. Writing to an empty field, no-op
// writes, and list adds/removes never conflict here; list contradictions are
// reported by the assistant instead.

// Identifies what a conflict is about. At most one pending conflict exists per
// key: scalars by field, travel documents by document name, lists by field.
export function conflictKeyFor(change: ProfileChange): string {
  if (isDocumentChange(change) && change.documents.length === 1) {
    return `travelDocuments:${documentKey(change.documents[0])}`;
  }
  return change.field;
}

export interface DetectedOverwrite {
  key: string;
  field: ProfileField;
  // The value being replaced: the scalar, or the saved document.
  existing: unknown;
  change: ProfileChange;
}

export interface DetectionResult {
  // Changes to apply now, in order.
  apply: ProfileChange[];
  // Overwrites held back until the user decides.
  conflicts: DetectedOverwrite[];
  // Overwrites the model marked userConfirmed; applied, but kept for audit.
  confirmedOverwrites: DetectedOverwrite[];
}

const sameScalar = (a: unknown, b: unknown) =>
  typeof a === "string" && typeof b === "string" ? a.toLowerCase() === b.toLowerCase() : a === b;

const sameDocument = (a: TravelDocument, b: TravelDocument) =>
  a.documentNumber.toLowerCase() === b.documentNumber.toLowerCase() &&
  a.nameOnDocument.toLowerCase() === b.nameOnDocument.toLowerCase();

export function detectOverwrites(profile: TravelProfile, changes: ProfileChange[]): DetectionResult {
  const result: DetectionResult = { apply: [], conflicts: [], confirmedOverwrites: [] };
  // Track the profile as clean changes apply, so later changes in the same
  // call are checked against earlier ones.
  let working = profile;

  const accept = (change: ProfileChange) => {
    result.apply.push(change);
    working = applyProfileChanges(working, [change]);
  };

  const overwrite = (change: ProfileChange, existing: unknown) => {
    const detected = { key: conflictKeyFor(change), field: change.field, existing, change };
    if (change.userConfirmed) {
      result.confirmedOverwrites.push(detected);
      accept(change);
    } else {
      result.conflicts.push(detected);
    }
  };

  for (const change of changes) {
    if (isScalarChange(change)) {
      const existing = working[change.field];
      const next = normalizeScalar(change);
      if (sameScalar(existing, next)) continue; // no-op
      if (existing === null) accept(change);
      else overwrite(change, existing);
      continue;
    }

    if (isDocumentChange(change) && change.op === "add") {
      // Each document is checked on its own so one conflict doesn't hold
      // back the others.
      for (const item of change.documents) {
        const single: ProfileChange = { ...change, documents: [item satisfies DocumentChangeItem] };
        const existing = working.travelDocuments.find((doc) => documentKey(doc) === documentKey(item));
        if (!existing) accept(single);
        else if (!sameDocument(existing, toDocument(item))) overwrite(single, existing);
      }
      continue;
    }

    // List adds/removes and document removals.
    accept(change);
  }

  return result;
}
