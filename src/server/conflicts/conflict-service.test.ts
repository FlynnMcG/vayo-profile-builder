import { beforeEach, describe, expect, it } from "vitest";
import type { ProfileChange } from "@/lib/profile/changes";
import { SAM } from "../../../test/fixtures/profiles";
import { createInMemoryDeps } from "../../../test/helpers/in-memory-deps";
import type { ConflictService, TurnContext, UpdateProfileOutcome } from "./conflict-service";

const turn = (n: number): TurnContext => ({ chatId: "c1", userMessageId: `u${n}` });

function expectOk(outcome: UpdateProfileOutcome) {
  if (!outcome.ok) throw new Error(`Expected ok, got: ${outcome.error}`);
  return outcome;
}

describe("conflict service", () => {
  let service: ConflictService;
  let deps: ReturnType<typeof createInMemoryDeps>;

  beforeEach(() => {
    deps = createInMemoryDeps();
    deps.profileStore.create(SAM);
    service = deps.conflictService;
  });

  const luxury: ProfileChange = { field: "budgetTier", value: "luxury" };

  describe("updateProfile", () => {
    it("applies writes to empty fields without conflicts", () => {
      deps.profileStore.delete();
      const outcome = expectOk(service.updateProfile([{ field: "name", value: "Sam" }], turn(1)));
      expect(outcome.conflicts).toEqual([]);
      expect(service.getProfile().name).toBe("Sam");
    });

    it("holds an overwrite as a pending conflict and leaves the profile unchanged", () => {
      const outcome = expectOk(service.updateProfile([luxury], turn(1)));
      expect(outcome.applied).toEqual([]);
      expect(outcome.conflicts).toHaveLength(1);
      expect(outcome.conflicts[0]).toMatchObject({
        field: "budgetTier",
        existing: "midRange",
        proposed: luxury,
        status: "pending",
        source: "overwrite",
        chatId: "c1",
        raisedInMessageId: "u1",
      });
      expect(service.getProfile().budgetTier).toBe("midRange");
      expect(service.listPending()).toHaveLength(1);
    });

    it("applies the clean changes in a call and holds only the conflicting one", () => {
      const outcome = expectOk(
        service.updateProfile([luxury, { field: "interests", op: "add", values: ["hiking"] }], turn(1)),
      );
      expect(outcome.applied).toEqual([{ field: "interests", op: "add", values: ["hiking"] }]);
      expect(outcome.conflicts.map((c) => c.field)).toEqual(["budgetTier"]);
      expect(service.getProfile().interests).toContain("hiking");
    });

    it("dedupes an identical conflict", () => {
      const first = expectOk(service.updateProfile([luxury], turn(1))).conflicts[0];
      const second = expectOk(service.updateProfile([luxury], turn(2))).conflicts[0];
      expect(second.id).toBe(first.id);
      expect(service.listPending()).toHaveLength(1);
    });

    it("replaces a pending conflict on the same field with a new one", () => {
      const first = expectOk(service.updateProfile([luxury], turn(1))).conflicts[0];
      const second = expectOk(service.updateProfile([{ field: "budgetTier", value: "budget" }], turn(2))).conflicts[0];
      expect(second.id).not.toBe(first.id);
      expect(service.listPending().map((c) => c.id)).toEqual([second.id]);
      expect(deps.db.prepare("SELECT status FROM profile_conflicts WHERE id = ?").get(first.id)).toEqual({
        status: "superseded",
      });
    });

    it("keeps conflicts on different fields separate", () => {
      expectOk(service.updateProfile([luxury, { field: "homeAirport", value: "JFK" }], turn(1)));
      expect(service.listPending().map((c) => c.field).sort()).toEqual(["budgetTier", "homeAirport"]);
    });

    describe("userConfirmed", () => {
      it("applies the overwrite and records it as resolved for audit", () => {
        const outcome = expectOk(service.updateProfile([{ ...luxury, userConfirmed: true }], turn(1)));
        expect(outcome.conflicts).toEqual([]);
        expect(service.getProfile().budgetTier).toBe("luxury");
        expect(service.listPending()).toEqual([]);
        expect(
          deps.db.prepare("SELECT status, resolution, existing_value FROM profile_conflicts").all(),
        ).toEqual([{ status: "resolved", resolution: '{"type":"user_confirmed"}', existing_value: '"midRange"' }]);
      });

      it("settles a pending conflict from an earlier turn on the same field", () => {
        expectOk(service.updateProfile([luxury], turn(1)));
        expectOk(service.updateProfile([{ field: "budgetTier", value: "budget", userConfirmed: true }], turn(2)));
        expect(service.getProfile().budgetTier).toBe("budget");
        expect(service.listPending()).toEqual([]);
      });

      it("can't bypass a conflict raised this turn", () => {
        expectOk(service.updateProfile([luxury], turn(1)));
        const outcome = expectOk(service.updateProfile([{ ...luxury, userConfirmed: true }], turn(1)));
        expect(outcome.applied).toEqual([]);
        expect(outcome.rejected).toHaveLength(1);
        expect(service.getProfile().budgetTier).toBe("midRange");
      });
    });

    it("rejects any change to a field whose conflict was raised this turn", () => {
      expectOk(service.updateProfile([luxury], turn(1)));
      const outcome = expectOk(service.updateProfile([{ field: "budgetTier", value: "budget" }], turn(1)));
      expect(outcome.rejected.map((r) => r.change.field)).toEqual(["budgetTier"]);
      expect(outcome.conflicts).toEqual([]);
    });

    it("returns an error and saves nothing when a change is invalid", () => {
      const outcome = service.updateProfile(
        [{ field: "interests", op: "add", values: ["art"] }, { field: "homeAirport", value: "1!2" }],
        turn(1),
      );
      expect(outcome.ok).toBe(false);
      expect(service.getProfile()).toEqual(SAM);
    });
  });

  describe("travel documents", () => {
    const renewed = { ...SAM.travelDocuments[0], documentNumber: "Y87654321" };
    const renewPassport: ProfileChange = { field: "travelDocuments", op: "add", documents: [renewed] };

    it("raises a conflict when a saved document changes, and resolving replaces it", () => {
      const conflict = expectOk(service.updateProfile([renewPassport], turn(1))).conflicts[0];
      expect(conflict.key).toBe("travelDocuments:passport");

      const resolved = service.resolveConflict(conflict.id, { resolution: { type: "accept_proposed" } }, turn(2));
      expect(resolved.ok).toBe(true);
      expect(service.getProfile().travelDocuments).toEqual([renewed]);
    });

    it("keeps one pending conflict per document name", () => {
      expectOk(service.updateProfile([renewPassport], turn(1)));
      expectOk(
        service.updateProfile(
          [{ field: "travelDocuments", op: "add", documents: [{ ...renewed, documentNumber: "Z1" }] }],
          turn(2),
        ),
      );
      expect(service.listPending()).toHaveLength(1);
      expect(service.listPending()[0].proposed).toMatchObject({ documents: [{ documentNumber: "Z1" }] });
    });
  });

  describe("resolveConflict", () => {
    let conflictId: string;

    beforeEach(() => {
      conflictId = expectOk(service.updateProfile([luxury], turn(1))).conflicts[0].id;
    });

    it("refuses to resolve in the same turn the conflict was raised", () => {
      const outcome = service.resolveConflict(conflictId, { resolution: { type: "accept_proposed" } }, turn(1));
      expect(outcome).toMatchObject({ ok: false, code: "same_turn" });
      expect(service.listPending()).toHaveLength(1);
    });

    it("accept_proposed applies the change and marks it resolved", () => {
      const outcome = service.resolveConflict(conflictId, { resolution: { type: "accept_proposed" } }, turn(2));
      expect(outcome).toMatchObject({ ok: true, conflict: { status: "resolved" } });
      expect(service.getProfile().budgetTier).toBe("luxury");
      expect(service.listPending()).toEqual([]);
    });

    it("keep_existing leaves the profile and marks it resolved", () => {
      const outcome = service.resolveConflict(conflictId, { resolution: { type: "keep_existing" } }, turn(2));
      expect(outcome).toMatchObject({ ok: true, conflict: { resolution: { type: "keep_existing" } } });
      expect(service.getProfile().budgetTier).toBe("midRange");
    });

    it("custom applies the user's own answer", () => {
      const outcome = service.resolveConflict(
        conflictId,
        { resolution: { type: "custom", change: { field: "budgetTier", value: "budget" } } },
        turn(2),
      );
      expect(outcome.ok).toBe(true);
      expect(service.getProfile().budgetTier).toBe("budget");
    });

    it("rejects a custom change to a different field", () => {
      const outcome = service.resolveConflict(
        conflictId,
        { resolution: { type: "custom", change: { field: "name", value: "Alex" } } },
        turn(2),
      );
      expect(outcome).toMatchObject({ ok: false, code: "invalid" });
      expect(service.listPending()).toHaveLength(1);
    });

    it("can't resolve twice", () => {
      service.resolveConflict(conflictId, { resolution: { type: "keep_existing" } }, turn(2));
      const again = service.resolveConflict(conflictId, { resolution: { type: "accept_proposed" } }, turn(3));
      expect(again).toMatchObject({ ok: false, code: "not_pending" });
    });

    it("reports an unknown id", () => {
      expect(service.resolveConflict("nope", { resolution: { type: "keep_existing" } })).toMatchObject({
        ok: false,
        code: "not_found",
      });
    });

    it("marks a conflict stale if the field changed underneath it", () => {
      deps.profileStore.update({ budgetTier: "budget" });
      const outcome = service.resolveConflict(conflictId, { resolution: { type: "accept_proposed" } }, turn(2));
      expect(outcome).toMatchObject({ ok: false, code: "stale" });
      expect(service.listPending()).toEqual([]);
      expect(service.getProfile().budgetTier).toBe("budget");
    });

    it("can be resolved without a turn (HTTP API)", () => {
      expect(service.resolveConflict(conflictId, { resolution: { type: "keep_existing" } }).ok).toBe(true);
    });
  });

  describe("reportConflict", () => {
    const addTokyo: ProfileChange = { field: "wishlist", op: "add", values: ["Tokyo"] };

    it("holds a list change the assistant flagged, until resolved", () => {
      deps.profileStore.update({ avoid: ["Japan"] });
      const outcome = service.reportConflict({ change: addTokyo, reason: "Japan is in avoid" }, turn(1));
      expect(outcome).toMatchObject({
        ok: true,
        conflict: { source: "reported", field: "wishlist", reason: "Japan is in avoid", existing: ["Lisbon"] },
      });
      expect(service.getProfile().wishlist).toEqual(["Lisbon"]);

      if (!outcome.ok) throw new Error("unreachable");
      service.resolveConflict(outcome.conflict.id, { resolution: { type: "accept_proposed" } }, turn(2));
      expect(service.getProfile().wishlist).toEqual(["Lisbon", "Tokyo"]);
    });

    it("works for removals too", () => {
      const outcome = service.reportConflict(
        { change: { field: "interests", op: "remove", values: ["food"] }, reason: "Said they love food earlier" },
        turn(1),
      );
      expect(outcome.ok).toBe(true);
      expect(service.getProfile().interests).toContain("food");
    });

    it("isn't marked stale by other list edits", () => {
      const outcome = service.reportConflict({ change: addTokyo, reason: "Japan is in avoid" }, turn(1));
      if (!outcome.ok) throw new Error("unreachable");
      expectOk(service.updateProfile([{ field: "wishlist", op: "add", values: ["Paris"] }], turn(2)));
      expect(service.listPending()).toHaveLength(1);
      const resolved = service.resolveConflict(outcome.conflict.id, { resolution: { type: "accept_proposed" } }, turn(3));
      expect(resolved.ok).toBe(true);
    });

    it("rejects an invalid report", () => {
      expect(service.reportConflict({ change: addTokyo, reason: "" })).toMatchObject({ ok: false, code: "invalid" });
    });
  });

  describe("resetProfile", () => {
    it("clears the profile and supersedes pending conflicts", () => {
      expectOk(service.updateProfile([luxury], turn(1)));
      service.resetProfile();
      expect(service.getProfile().name).toBeNull();
      expect(service.listPending()).toEqual([]);
    });
  });
});

describe("conflict service: validation of held changes", () => {
  it("rejects an invalid report instead of storing it", () => {
    const { conflictService } = createInMemoryDeps();
    const outcome = conflictService.reportConflict({
      change: { field: "homeAirport", value: "1!2" },
      reason: "test",
    });
    expect(outcome).toMatchObject({ ok: false, code: "invalid" });
    expect(conflictService.listPending()).toEqual([]);
  });

  it("does not store an invalid overwrite as a conflict", () => {
    const deps = createInMemoryDeps();
    deps.profileStore.create(SAM);
    const outcome = deps.conflictService.updateProfile([{ field: "homeAirport", value: "1!2" }], turn(1));
    expect(outcome.ok).toBe(false);
    expect(deps.conflictService.listPending()).toEqual([]);
  });
});
