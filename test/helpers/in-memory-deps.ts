import type { ChatServiceDeps } from "@/server/chat/chat-service";
import { createChatHistoryStore } from "@/server/chat/history-store";
import { openSeededDatabase, type Database } from "@/server/db/database";
import { createDestinationStore } from "@/server/destinations/destination-store";
import { createProfileStore } from "@/server/profile/profile-store";

// Chat service dependencies backed by a fresh, seeded in-memory database.
// Shared by unit tests and (later) evals.
export function createInMemoryDeps(): ChatServiceDeps & { db: Database } {
  const db = openSeededDatabase();
  return {
    db,
    historyStore: createChatHistoryStore(db),
    profileStore: createProfileStore(db),
    destinationStore: createDestinationStore(db),
  };
}
