import "server-only";
import type { DatabaseSync } from "node:sqlite";

// Runs fn in a transaction, rolling back if it throws. Not reentrant.
export function withTransaction<T>(db: DatabaseSync, fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
