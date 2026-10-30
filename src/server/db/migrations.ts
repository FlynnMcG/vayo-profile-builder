import "server-only";
import type { DatabaseSync } from "node:sqlite";
import { BudgetTierSchema, VisaRequirementSchema } from "@/lib/destinations/schema";

const sqlList = (values: readonly string[]) => values.map((v) => `'${v}'`).join(", ");

// Append-only: each entry runs once, tracked by PRAGMA user_version.
const MIGRATIONS: string[] = [
  `
  CREATE TABLE destinations (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    best_seasons TEXT NOT NULL CHECK (json_valid(best_seasons)),
    known_for TEXT NOT NULL CHECK (json_valid(known_for)),
    budget_usd INTEGER NOT NULL,
    mid_range_usd INTEGER NOT NULL,
    luxury_usd INTEGER NOT NULL,
    visa_requirement TEXT CHECK (visa_requirement IN (${sqlList(VisaRequirementSchema.options)})),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE chat_messages (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id TEXT NOT NULL,
    id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (chat_id, id)
  );

  CREATE INDEX chat_messages_chat_id ON chat_messages (chat_id, seq);
  `,
  `
  CREATE TABLE profile (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    name TEXT,
    citizenship TEXT CHECK (citizenship GLOB '[A-Z][A-Z]'),
    budget_tier TEXT CHECK (budget_tier IN (${sqlList(BudgetTierSchema.options)})),
    preferred_seasons TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(preferred_seasons)),
    interests TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(interests)),
    wishlist TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(wishlist)),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  `,
  `
  ALTER TABLE profile ADD COLUMN home_airport TEXT CHECK (home_airport GLOB '[A-Z][A-Z][A-Z]');
  ALTER TABLE profile ADD COLUMN total_budget_usd INTEGER CHECK (total_budget_usd > 0);
  ALTER TABLE profile ADD COLUMN preferred_climates TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(preferred_climates));
  ALTER TABLE profile ADD COLUMN companions TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(companions));
  ALTER TABLE profile ADD COLUMN ideal_trip_types TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(ideal_trip_types));
  ALTER TABLE profile ADD COLUMN avoid TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(avoid));
  -- Stored in full (local, single user); masked before reaching the model or UI.
  ALTER TABLE profile ADD COLUMN travel_documents TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(travel_documents));
  `,
];

// Runs pending migrations up to `targetVersion` (default: latest). Tests use
// the target to build an older schema and then upgrade it.
export function migrate(db: DatabaseSync, targetVersion: number = MIGRATIONS.length): void {
  const { user_version: current } = db.prepare("PRAGMA user_version").get() as {
    user_version: number;
  };

  for (let version = current; version < targetVersion; version++) {
    db.exec("BEGIN");
    try {
      db.exec(MIGRATIONS[version]);
      db.exec(`PRAGMA user_version = ${version + 1}`);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
}
