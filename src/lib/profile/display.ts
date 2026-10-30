import type { ProfileField, TravelProfile } from "./schema";

export interface ProfileDisplayRow {
  field: ProfileField;
  label: string;
  values: string[];
}

const FIELD_LABELS: Record<ProfileField, string> = {
  homeAirport: "Home airport",
  budget: "Budget",
  seatPreference: "Seat preference",
  travelStyle: "Travel style",
  accommodation: "Accommodation",
  interests: "Interests",
  dietary: "Dietary needs",
  wishlist: "Wishlist",
};

const ENUM_LABELS: Record<string, string> = {
  budget: "Budget",
  moderate: "Moderate",
  luxury: "Luxury",
  window: "Window",
  aisle: "Aisle",
  no_preference: "No preference",
};

function toValues(value: TravelProfile[ProfileField]): string[] {
  if (value === null) return [];
  if (Array.isArray(value)) return value;
  return [ENUM_LABELS[value] ?? value];
}

// Converts a profile into ordered, presentation-ready rows so UI components
// stay free of formatting logic.
export function toDisplayRows(profile: TravelProfile): ProfileDisplayRow[] {
  return (Object.keys(FIELD_LABELS) as ProfileField[]).map((field) => ({
    field,
    label: FIELD_LABELS[field],
    values: toValues(profile[field]),
  }));
}
