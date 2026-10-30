import "server-only";
import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import {
  ProfileConflictSchema,
  type ConflictResolution,
  type ProfileConflict,
} from "@/lib/conflicts/schema";

export type NewConflict = Omit<ProfileConflict, "id" | "status" | "resolution" | "createdAt" | "resolvedAt">;

// Persistence for profile conflicts; the rules live in the conflict service.
export interface ConflictStore {
  get(id: string): ProfileConflict | null;
  listPending(): ProfileConflict[];
  findPendingByKey(key: string): ProfileConflict | null;
  insertPending(conflict: NewConflict): ProfileConflict;
  // Records an overwrite that skipped the question (userConfirmed), for audit.
  insertConfirmed(conflict: NewConflict, resolvedInMessageId: string | null): ProfileConflict;
  markResolved(id: string, resolution: ConflictResolution, resolvedInMessageId: string | null): ProfileConflict;
  markSuperseded(id: string): void;
  supersedeAllPending(): void;
}

const ConflictRowSchema = z.object({
  id: z.string(),
  conflict_key: z.string(),
  field: z.string(),
  source: z.string(),
  existing_value: z.string(),
  proposed_change: z.string(),
  reason: z.string().nullable(),
  status: z.string(),
  resolution: z.string().nullable(),
  chat_id: z.string().nullable(),
  raised_in_message_id: z.string().nullable(),
  created_at: z.string(),
  resolved_at: z.string().nullable(),
});

function fromRow(row: unknown): ProfileConflict {
  const r = ConflictRowSchema.parse(row);
  return ProfileConflictSchema.parse({
    id: r.id,
    key: r.conflict_key,
    field: r.field,
    source: r.source,
    existing: JSON.parse(r.existing_value),
    proposed: JSON.parse(r.proposed_change),
    reason: r.reason,
    status: r.status,
    resolution: r.resolution ? JSON.parse(r.resolution) : null,
    chatId: r.chat_id,
    raisedInMessageId: r.raised_in_message_id,
    createdAt: r.created_at,
    resolvedAt: r.resolved_at,
  });
}

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

export function createConflictStore(db: DatabaseSync): ConflictStore {
  const selectOne = db.prepare("SELECT * FROM profile_conflicts WHERE id = ?");
  const selectPending = db.prepare(
    "SELECT * FROM profile_conflicts WHERE status = 'pending' ORDER BY created_at, rowid",
  );
  const selectPendingByKey = db.prepare(
    "SELECT * FROM profile_conflicts WHERE status = 'pending' AND conflict_key = ?",
  );
  const insert = db.prepare(
    `INSERT INTO profile_conflicts
       (id, conflict_key, field, source, existing_value, proposed_change, reason, status,
        resolution, chat_id, raised_in_message_id, resolved_in_message_id, resolved_at)
     VALUES (:id, :key, :field, :source, :existing, :proposed, :reason, :status,
        :resolution, :chatId, :raisedInMessageId, :resolvedInMessageId,
        CASE WHEN :status = 'pending' THEN NULL ELSE ${NOW} END)`,
  );
  const resolve = db.prepare(
    `UPDATE profile_conflicts
     SET status = 'resolved', resolution = ?, resolved_in_message_id = ?, resolved_at = ${NOW}
     WHERE id = ? AND status = 'pending'`,
  );
  const supersede = db.prepare(
    `UPDATE profile_conflicts SET status = 'superseded', resolved_at = ${NOW}
     WHERE id = ? AND status = 'pending'`,
  );
  const supersedeAll = db.prepare(
    `UPDATE profile_conflicts SET status = 'superseded', resolved_at = ${NOW} WHERE status = 'pending'`,
  );

  const get = (id: string) => {
    const row = selectOne.get(id);
    return row ? fromRow(row) : null;
  };

  const insertRow = (
    conflict: NewConflict,
    status: "pending" | "resolved",
    resolution: ConflictResolution | null,
    resolvedInMessageId: string | null,
  ) => {
    const id = crypto.randomUUID();
    insert.run({
      id,
      key: conflict.key,
      field: conflict.field,
      source: conflict.source,
      existing: JSON.stringify(conflict.existing ?? null),
      proposed: JSON.stringify(conflict.proposed),
      reason: conflict.reason,
      status,
      resolution: resolution ? JSON.stringify(resolution) : null,
      chatId: conflict.chatId,
      raisedInMessageId: conflict.raisedInMessageId,
      resolvedInMessageId,
    });
    return get(id)!;
  };

  return {
    get,
    listPending: () => selectPending.all().map(fromRow),
    findPendingByKey(key) {
      const row = selectPendingByKey.get(key);
      return row ? fromRow(row) : null;
    },
    insertPending: (conflict) => insertRow(conflict, "pending", null, null),
    insertConfirmed: (conflict, resolvedInMessageId) =>
      insertRow(conflict, "resolved", { type: "user_confirmed" }, resolvedInMessageId),
    markResolved(id, resolution, resolvedInMessageId) {
      resolve.run(JSON.stringify(resolution), resolvedInMessageId, id);
      return get(id)!;
    },
    markSuperseded: (id) => void supersede.run(id),
    supersedeAllPending: () => void supersedeAll.run(),
  };
}
