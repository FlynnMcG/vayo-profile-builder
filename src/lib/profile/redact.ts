import type { TravelProfile } from "./schema";

const MASK = "••••";

// Shows only the last 4 characters of a document number. Safe to apply twice.
export function maskDocumentNumber(documentNumber: string): string {
  if (documentNumber.startsWith(MASK)) return documentNumber;
  return documentNumber.length <= 4 ? MASK : `${MASK}${documentNumber.slice(-4)}`;
}

// The profile with document numbers masked. Use this for anything that
// leaves the database toward the model or the UI; neither needs full numbers.
export function redactProfile(profile: TravelProfile): TravelProfile {
  return {
    ...profile,
    travelDocuments: profile.travelDocuments.map((doc) => ({
      ...doc,
      documentNumber: maskDocumentNumber(doc.documentNumber),
    })),
  };
}
