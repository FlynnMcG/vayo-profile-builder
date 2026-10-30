import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptyProfile } from "@/lib/profile/schema";

// connection() needs a live Next request; outside Next it's a no-op here.
vi.mock("next/server", () => ({ connection: async () => {} }));

const { GET, PATCH, DELETE } = await import("./route");

const patch = (body: unknown) =>
  PATCH(new Request("http://test/api/profile", { method: "PATCH", body: JSON.stringify(body) }));

describe("/api/profile", () => {
  beforeEach(() => {
    // Give each test a fresh in-memory app database.
    vi.stubEnv("DATABASE_PATH", ":memory:");
    delete (globalThis as { vayoDatabase?: unknown }).vayoDatabase;
  });

  it("GET returns an empty profile before anything is saved", async () => {
    expect(await (await GET()).json()).toEqual({ profile: emptyProfile });
  });

  it("PATCH updates fields and GET reflects them", async () => {
    const res = await patch({ name: "Sam", interests: ["food"] });
    expect(res.status).toBe(200);
    expect(await (await GET()).json()).toEqual({
      profile: { ...emptyProfile, name: "Sam", interests: ["food"] },
    });
  });

  it("masks travel document numbers in responses", async () => {
    const doc = { documentName: "Passport", documentNumber: "X12345678", nameOnDocument: "Sam Lee" };
    const patched = await (await patch({ travelDocuments: [doc] })).json();
    const fetched = await (await GET()).json();
    for (const body of [patched, fetched]) {
      expect(body.profile.travelDocuments).toEqual([{ ...doc, documentNumber: "••••5678" }]);
    }
  });

  it("PATCH rejects invalid bodies with 400", async () => {
    expect((await patch({ budgetTier: "cheap" })).status).toBe(400);
    expect((await patch({ unknownField: true })).status).toBe(400);
    expect((await patch("not an object")).status).toBe(400);
  });

  it("DELETE resets the profile", async () => {
    await patch({ name: "Sam" });
    await DELETE();
    expect(await (await GET()).json()).toEqual({ profile: emptyProfile });
  });
});
