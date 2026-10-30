import "server-only";
import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import {
  emptyProfile,
  ProfileUpdateSchema,
  TravelProfileSchema,
  type ProfileField,
  type ProfileUpdate,
  type TravelProfile,
} from "@/lib/profile/schema";

export class ProfileExistsError extends Error {
  constructor() {
    super("A profile already exists");
    this.name = "ProfileExistsError";
  }
}

// There is one profile for now (multiple profiles are out of scope), stored
// as the single row with id 1.
export interface ProfileStore {
  get(): TravelProfile | null;
  create(profile: TravelProfile): TravelProfile;
  // Replaces the given fields. Creates the profile from empty if none exists,
  // so the first preference learned in chat can always be saved.
  update(changes: ProfileUpdate): TravelProfile;
  delete(): boolean;
}

// Profile field -> column. List fields are stored as JSON text.
const SCALAR_COLUMNS = {
  name: "name",
  citizenship: "citizenship",
  homeAirport: "home_airport",
  budgetTier: "budget_tier",
  totalBudgetUSD: "total_budget_usd",
} as const;

const JSON_COLUMNS = {
  preferredSeasons: "preferred_seasons",
  preferredClimates: "preferred_climates",
  companions: "companions",
  interests: "interests",
  idealTripTypes: "ideal_trip_types",
  avoid: "avoid",
  wishlist: "wishlist",
  travelDocuments: "travel_documents",
} as const;

// Fails to compile if a profile field has no column.
const FIELD_COLUMNS = { ...SCALAR_COLUMNS, ...JSON_COLUMNS } satisfies Record<ProfileField, string>;

const COLUMN_NAMES = Object.values(FIELD_COLUMNS);
const COLUMNS = COLUMN_NAMES.join(", ");
const PLACEHOLDERS = COLUMN_NAMES.map((column) => `:${column}`).join(", ");

const ProfileRowSchema = z.record(z.string(), z.union([z.string(), z.number(), z.null()]));

function fromRow(row: unknown): TravelProfile {
  const r = ProfileRowSchema.parse(row);
  const profile: Record<string, unknown> = {};
  for (const [field, column] of Object.entries(SCALAR_COLUMNS)) profile[field] = r[column];
  for (const [field, column] of Object.entries(JSON_COLUMNS)) profile[field] = JSON.parse(String(r[column]));
  return TravelProfileSchema.parse(profile);
}

function toRow(profile: TravelProfile): Record<string, string | number | null> {
  const row: Record<string, string | number | null> = {};
  for (const [field, column] of Object.entries(SCALAR_COLUMNS)) {
    row[column] = profile[field as keyof typeof SCALAR_COLUMNS];
  }
  for (const [field, column] of Object.entries(JSON_COLUMNS)) {
    row[column] = JSON.stringify(profile[field as keyof typeof JSON_COLUMNS]);
  }
  return row;
}

export function createProfileStore(db: DatabaseSync): ProfileStore {
  const selectProfile = db.prepare(`SELECT ${COLUMNS} FROM profile WHERE id = 1`);
  const insertProfile = db.prepare(`INSERT INTO profile (id, ${COLUMNS}) VALUES (1, ${PLACEHOLDERS})`);
  const upsertProfile = db.prepare(
    `INSERT INTO profile (id, ${COLUMNS}) VALUES (1, ${PLACEHOLDERS})
     ON CONFLICT (id) DO UPDATE SET
       ${COLUMN_NAMES.map((column) => `${column} = excluded.${column}`).join(", ")},
       updated_at = datetime('now')`,
  );
  const deleteProfile = db.prepare("DELETE FROM profile WHERE id = 1");

  const get = (): TravelProfile | null => {
    const row = selectProfile.get();
    return row ? fromRow(row) : null;
  };

  return {
    get,

    create(profile) {
      const valid = TravelProfileSchema.parse(profile);
      if (get()) throw new ProfileExistsError();
      insertProfile.run(toRow(valid));
      return get()!;
    },

    update(changes) {
      const merged = TravelProfileSchema.parse({
        ...(get() ?? emptyProfile),
        ...ProfileUpdateSchema.parse(changes),
      });
      upsertProfile.run(toRow(merged));
      return get()!;
    },

    delete: () => deleteProfile.run().changes > 0,
  };
}
