import { beforeEach, describe, expect, it, vi } from "vitest";
import { getServices } from "@/server/services";
import { SAM } from "../../../../test/fixtures/profiles";

vi.mock("next/server", () => ({ connection: async () => {} }));

const { GET, POST } = await import("./route");
const resolveRoute = await import("./[id]/resolve/route");

const post = (body: unknown) =>
  POST(new Request("http://test/api/conflicts", { method: "POST", body: JSON.stringify(body) }));

const resolve = (id: string, body: unknown) =>
  resolveRoute.POST(new Request(`http://test/api/conflicts/${id}/resolve`, { method: "POST", body: JSON.stringify(body) }), {
    params: Promise.resolve({ id }),
  });

describe("/api/conflicts", () => {
  beforeEach(() => {
    vi.stubEnv("DATABASE_PATH", ":memory:");
    delete (globalThis as { vayoDatabase?: unknown }).vayoDatabase;
    getServices().conflictService.updateProfile([
      { field: "budgetTier", value: "midRange" },
      { field: "travelDocuments", op: "add", documents: [SAM.travelDocuments[0]] },
    ]);
  });

  it("GET lists pending conflicts with document numbers masked", async () => {
    getServices().conflictService.updateProfile([
      { field: "travelDocuments", op: "add", documents: [{ ...SAM.travelDocuments[0], documentNumber: "Y87654321" }] },
    ]);
    const body = await (await GET()).json();
    expect(body.conflicts).toHaveLength(1);
    expect(JSON.stringify(body)).not.toMatch(/X12345678|Y87654321/);
    expect(JSON.stringify(body)).toContain("••••4321");
  });

  it("POST reports a conflict (201) and rejects bad input (400)", async () => {
    const res = await post({ change: { field: "wishlist", op: "add", values: ["Tokyo"] }, reason: "Japan in avoid" });
    expect(res.status).toBe(201);
    expect((await res.json()).conflict).toMatchObject({ source: "reported", status: "pending" });
    expect((await post({ change: { field: "nope" }, reason: "x" })).status).toBe(400);
  });

  describe("POST /api/conflicts/[id]/resolve", () => {
    it("resolves and returns the updated profile", async () => {
      getServices().conflictService.updateProfile([{ field: "budgetTier", value: "luxury" }]);
      const [conflict] = getServices().conflictService.listPending();
      const res = await resolve(conflict.id, { resolution: { type: "accept_proposed" } });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.profile.budgetTier).toBe("luxury");
      expect(body.conflict.status).toBe("resolved");
    });

    it("maps errors to status codes", async () => {
      expect((await resolve("missing", { resolution: { type: "keep_existing" } })).status).toBe(404);
      expect((await resolve("missing", { resolution: { type: "maybe" } })).status).toBe(400);

      getServices().conflictService.updateProfile([{ field: "budgetTier", value: "luxury" }]);
      const [conflict] = getServices().conflictService.listPending();
      await resolve(conflict.id, { resolution: { type: "keep_existing" } });
      expect((await resolve(conflict.id, { resolution: { type: "keep_existing" } })).status).toBe(409);
    });
  });
});
