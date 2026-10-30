import type { BudgetTier } from "@/lib/destinations/schema";
import { maskDocumentNumber } from "./redact";
import { emptyProfile, type Companion, type ProfileField, type TravelDocument, type TravelProfile } from "./schema";

export interface ProfileDisplayRow {
  field: ProfileField;
  label: string;
  values: string[];
}

// Display order and labels.
const FIELD_LABELS: Record<ProfileField, string> = {
  name: "Name",
  citizenship: "Citizenship",
  homeAirport: "Home airport",
  budgetTier: "Budget",
  totalBudgetUSD: "Total trip budget",
  companions: "Travels with",
  preferredSeasons: "Preferred seasons",
  preferredClimates: "Preferred climates",
  interests: "Interests",
  idealTripTypes: "Ideal trips",
  avoid: "Avoid",
  wishlist: "Wishlist",
  travelDocuments: "Travel documents",
};

const BUDGET_TIER_LABELS: Record<BudgetTier, string> = {
  budget: "Budget",
  midRange: "Mid-range",
  luxury: "Luxury",
};

const COMPANION_LABELS: Record<Companion, string> = {
  solo: "Solo",
  partner: "Partner",
  friends: "Friends",
  family: "Family",
  group: "Group",
};

const countryNames = new Intl.DisplayNames(["en"], { type: "region", fallback: "code" });

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

// Numbers are masked here too, in case an unredacted profile is displayed.
export const formatDocument = ({ documentName, documentNumber, nameOnDocument }: TravelDocument) =>
  `${documentName} ${maskDocumentNumber(documentNumber)} · ${nameOnDocument}`;

function toValues(profile: TravelProfile, field: ProfileField): string[] {
  switch (field) {
    case "name":
    case "homeAirport":
      return profile[field] ? [profile[field]] : [];
    case "citizenship":
      return profile.citizenship ? [countryNames.of(profile.citizenship) ?? profile.citizenship] : [];
    case "budgetTier":
      return profile.budgetTier ? [BUDGET_TIER_LABELS[profile.budgetTier]] : [];
    case "totalBudgetUSD":
      return profile.totalBudgetUSD ? [usd.format(profile.totalBudgetUSD)] : [];
    case "companions":
      return profile.companions.map((c) => COMPANION_LABELS[c]);
    case "preferredSeasons":
    case "preferredClimates":
      return profile[field].map(capitalize);
    case "interests":
    case "idealTripTypes":
    case "avoid":
    case "wishlist":
      return profile[field];
    case "travelDocuments":
      return profile.travelDocuments.map(formatDocument);
  }
}

// Formats one field's value, e.g. for showing both sides of a conflict.
export function formatFieldValue<F extends ProfileField>(field: F, value: TravelProfile[F]): string[] {
  return toValues({ ...emptyProfile, [field]: value }, field);
}

export const fieldLabel = (field: ProfileField) => FIELD_LABELS[field];

// Converts a profile into ordered, presentation-ready rows so UI components
// stay free of formatting logic.
export function toDisplayRows(profile: TravelProfile): ProfileDisplayRow[] {
  return (Object.keys(FIELD_LABELS) as ProfileField[]).map((field) => ({
    field,
    label: FIELD_LABELS[field],
    values: toValues(profile, field),
  }));
}

// Fields whose values differ between two profiles, for highlighting what the
// latest update changed.
export function changedFields(before: TravelProfile, after: TravelProfile): ProfileField[] {
  return (Object.keys(FIELD_LABELS) as ProfileField[]).filter(
    (field) => JSON.stringify(before[field]) !== JSON.stringify(after[field]),
  );
}
