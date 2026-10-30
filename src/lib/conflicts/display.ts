import { formatDocument, formatFieldValue } from "@/lib/profile/display";
import { toDocument, type ProfileChange } from "@/lib/profile/changes";
import type { ProfileField, TravelDocument, TravelProfile } from "@/lib/profile/schema";
import type { ProfileConflict } from "./schema";

// A conflict as the profile panel shows it.
export interface ConflictSummary {
  id: string;
  field: ProfileField;
  saved: string;
  proposed: string;
  reason: string | null;
}

const NOTHING = "Not set";

const joinOr = (values: string[]) => (values.length ? values.join(", ") : NOTHING);

function describeChange(change: ProfileChange): string {
  if ("value" in change) {
    return joinOr(formatFieldValue(change.field, change.value as TravelProfile[typeof change.field]));
  }
  if (change.field === "travelDocuments") {
    return change.op === "add"
      ? change.documents.map((doc) => formatDocument(toDocument(doc))).join(", ")
      : `Remove ${change.documents.map((doc) => doc.documentName).join(", ")}`;
  }
  const values = formatFieldValue(change.field, change.values as TravelProfile[typeof change.field]);
  return `${change.op === "add" ? "Add" : "Remove"} ${values.join(", ")}`;
}

function describeSaved(conflict: ProfileConflict): string {
  if (conflict.existing === null || conflict.existing === undefined) return NOTHING;
  if (conflict.field === "travelDocuments") return formatDocument(conflict.existing as TravelDocument);
  const field: ProfileField = conflict.field;
  return joinOr(formatFieldValue(field, conflict.existing as TravelProfile[typeof field]));
}

export function describeConflict(conflict: ProfileConflict): ConflictSummary {
  return {
    id: conflict.id,
    field: conflict.field,
    saved: describeSaved(conflict),
    proposed: describeChange(conflict.proposed),
    reason: conflict.reason,
  };
}
