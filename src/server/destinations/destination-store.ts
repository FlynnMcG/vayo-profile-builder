import "server-only";
import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import {
  DestinationInfoSchema,
  DestinationUpdateSchema,
  type DestinationInfo,
  type DestinationUpdate,
} from "@/lib/destinations/schema";

export class DestinationExistsError extends Error {
  constructor(name: string) {
    super(`Destination "${name}" already exists`);
    this.name = "DestinationExistsError";
  }
}

// Names are matched case-insensitively.
export interface DestinationStore {
  get(name: string): DestinationInfo | null;
  list(): DestinationInfo[];
  create(info: DestinationInfo): DestinationInfo;
  update(name: string, changes: DestinationUpdate): DestinationInfo | null;
  delete(name: string): boolean;
}

const DestinationRowSchema = z.object({
  name: z.string(),
  best_seasons: z.string(),
  known_for: z.string(),
  budget_usd: z.number(),
  mid_range_usd: z.number(),
  luxury_usd: z.number(),
  visa_requirement: z.string().nullable(),
});

type DestinationRow = z.infer<typeof DestinationRowSchema>;

const COLUMNS =
  "name, best_seasons, known_for, budget_usd, mid_range_usd, luxury_usd, visa_requirement";

function fromRow(row: unknown): DestinationInfo {
  const r = DestinationRowSchema.parse(row);
  return DestinationInfoSchema.parse({
    name: r.name,
    bestSeasons: JSON.parse(r.best_seasons),
    knownFor: JSON.parse(r.known_for),
    averageDailyBudgetUSD: {
      budget: r.budget_usd,
      midRange: r.mid_range_usd,
      luxury: r.luxury_usd,
    },
    ...(r.visa_requirement !== null && { visaRequirement: r.visa_requirement }),
  });
}

function toRow(info: DestinationInfo): DestinationRow {
  return {
    name: info.name,
    best_seasons: JSON.stringify(info.bestSeasons),
    known_for: JSON.stringify(info.knownFor),
    budget_usd: info.averageDailyBudgetUSD.budget,
    mid_range_usd: info.averageDailyBudgetUSD.midRange,
    luxury_usd: info.averageDailyBudgetUSD.luxury,
    visa_requirement: info.visaRequirement ?? null,
  };
}

const SQLITE_CONSTRAINT_UNIQUE = 2067;

function isUniqueViolation(error: unknown): boolean {
  return (error as { errcode?: number }).errcode === SQLITE_CONSTRAINT_UNIQUE;
}

export function createDestinationStore(db: DatabaseSync): DestinationStore {
  const selectOne = db.prepare(`SELECT ${COLUMNS} FROM destinations WHERE name = ?`);
  const selectAll = db.prepare(`SELECT ${COLUMNS} FROM destinations ORDER BY name`);
  const insert = db.prepare(
    `INSERT INTO destinations (${COLUMNS})
     VALUES (:name, :best_seasons, :known_for, :budget_usd, :mid_range_usd, :luxury_usd, :visa_requirement)`,
  );
  const updateOne = db.prepare(
    `UPDATE destinations SET
       best_seasons = :best_seasons, known_for = :known_for, budget_usd = :budget_usd,
       mid_range_usd = :mid_range_usd, luxury_usd = :luxury_usd,
       visa_requirement = :visa_requirement, updated_at = datetime('now')
     WHERE name = :name`,
  );
  const deleteOne = db.prepare("DELETE FROM destinations WHERE name = ?");

  const get = (name: string): DestinationInfo | null => {
    const row = selectOne.get(name.trim());
    return row ? fromRow(row) : null;
  };

  return {
    get,

    list: () => selectAll.all().map(fromRow),

    create(info) {
      const valid = DestinationInfoSchema.parse(info);
      try {
        insert.run(toRow(valid));
      } catch (error) {
        if (isUniqueViolation(error)) throw new DestinationExistsError(valid.name);
        throw error;
      }
      return get(valid.name)!;
    },

    update(name, changes) {
      const existing = get(name);
      if (!existing) return null;
      // Validate the merged record so cross-field rules (budget order) still hold.
      const merged = DestinationInfoSchema.parse({
        ...existing,
        ...DestinationUpdateSchema.parse(changes),
      });
      updateOne.run(toRow(merged));
      return get(existing.name);
    },

    delete: (name) => deleteOne.run(name.trim()).changes > 0,
  };
}

// Inserts any seed destinations that aren't already present.
export function seedDestinations(store: DestinationStore, seeds: DestinationInfo[]): void {
  for (const seed of seeds) {
    if (!store.get(seed.name)) store.create(seed);
  }
}
