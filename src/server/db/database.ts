import "server-only";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { SEED_DESTINATIONS } from "@/server/destinations/seed-data";
import { createDestinationStore, seedDestinations } from "@/server/destinations/destination-store";
import { migrate } from "./migrations";

export type Database = DatabaseSync;

// Opens a migrated database. Defaults to in-memory, which tests and evals use.
export function openDatabase(location: string = ":memory:"): Database {
  if (location !== ":memory:") {
    mkdirSync(path.dirname(location), { recursive: true });
  }
  const db = new DatabaseSync(location);
  db.exec("PRAGMA foreign_keys = ON");
  if (location !== ":memory:") db.exec("PRAGMA journal_mode = WAL");
  migrate(db);
  return db;
}

// Opens an in-memory database pre-loaded with the seed destinations.
export function openSeededDatabase(location: string = ":memory:"): Database {
  const db = openDatabase(location);
  seedDestinations(createDestinationStore(db), SEED_DESTINATIONS);
  return db;
}

const DEFAULT_DATABASE_PATH = path.join(process.cwd(), "data", "vayo.db");

// Keep one connection across dev hot reloads.
const globalDb = globalThis as typeof globalThis & { vayoDatabase?: Database };

// The app's shared database (file-backed; path overridable with DATABASE_PATH).
export function getDatabase(): Database {
  globalDb.vayoDatabase ??= openSeededDatabase(
    process.env.DATABASE_PATH || DEFAULT_DATABASE_PATH,
  );
  return globalDb.vayoDatabase;
}
