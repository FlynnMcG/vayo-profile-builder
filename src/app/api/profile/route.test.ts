import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptyProfile } from "@/lib/profile/schema";
import { getServices } from "@/server/services";
import { SAM } from "../../../../test/fixtures/profiles";

// connection() needs a live Next request; outside Next it's a no-op here.
vi.mock("next/server", () => ({ connection: async () => {} }));

const route = await import("./route");

describe("/api/profile", () => {
  beforeEach(() => {
    // Give each test a fresh in-memory app database.
    vi.stubEnv("DATABASE_PATH", ":memory:");
    delete (globalThis as { vayoDatabase?: unknown }).vayoDatabase;
  });

  it("GET returns an empty profile before anything is saved", async () => {
    expect(await (await route.GET()).json()).toEqual({ profile: emptyProfile });
  });

  it("GET returns the saved profile with document numbers masked", async () => {
    getServices().conflictService.updateProfile([
      { field: "name", value: "Sam" },
      { field: "travelDocuments", op: "add", documents: [SAM.travelDocuments[0]] },
    ]);
    const { profile } = await (await route.GET()).json();
    expect(profile.name).toBe("Sam");
    expect(profile.travelDocuments[0].documentNumber).toBe("••••5678");
  });

  it("is read-only: there is no PATCH", () => {
    expect("PATCH" in route).toBe(false);
  });

  it("DELETE resets the profile and clears pending conflicts", async () => {
    const { conflictService } = getServices();
    conflictService.updateProfile([{ field: "name", value: "Sam" }]);
    conflictService.updateProfile([{ field: "name", value: "Alex" }]);
    expect(conflictService.listPending()).toHaveLength(1);

    await route.DELETE();
    expect(await (await route.GET()).json()).toEqual({ profile: emptyProfile });
    expect(conflictService.listPending()).toEqual([]);
  });
});
