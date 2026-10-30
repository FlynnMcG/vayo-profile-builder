import "server-only";
import type { DatabaseSync } from "node:sqlite";
import { VisaRequirementSchema } from "@/lib/destinations/schema";

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
];

export function migrate(db: DatabaseSync): void {
  const { user_version: current } = db.prepare("PRAGMA user_version").get() as {
    user_version: number;
  };

  for (let version = current; version < MIGRATIONS.length; version++) {
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
