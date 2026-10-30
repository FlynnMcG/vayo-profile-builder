import { openSeededDatabase } from "@/server/db/database";
import { createProfileStore } from "@/server/profile/profile-store";
import { createServices } from "@/server/services";

// App services backed by a fresh, seeded in-memory database, plus direct
// store access for arranging test state. Shared by unit tests and (later) evals.
export function createInMemoryDeps() {
  const db = openSeededDatabase();
  return { ...createServices(db), db, profileStore: createProfileStore(db) };
}
