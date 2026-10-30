import "server-only";
import { createChatHistoryStore, type ChatHistoryStore } from "@/server/chat/history-store";
import { createConflictService, type ConflictService } from "@/server/conflicts/conflict-service";
import { createConflictStore } from "@/server/conflicts/conflict-store";
import { getDatabase, type Database } from "@/server/db/database";
import { createDestinationStore, type DestinationStore } from "@/server/destinations/destination-store";
import { createProfileStore } from "@/server/profile/profile-store";

export interface Services {
  historyStore: ChatHistoryStore;
  destinationStore: DestinationStore;
  // All profile reads and writes go through here, so conflict rules apply.
  conflictService: ConflictService;
}

// Wires services onto a database. Tests and evals pass an in-memory one.
export function createServices(db: Database): Services {
  return {
    historyStore: createChatHistoryStore(db),
    destinationStore: createDestinationStore(db),
    conflictService: createConflictService({
      db,
      profileStore: createProfileStore(db),
      conflictStore: createConflictStore(db),
    }),
  };
}

// Services on the app's shared database.
export const getServices = () => createServices(getDatabase());
