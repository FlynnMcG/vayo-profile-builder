import { mkdirSync, writeFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { emptyProfile, type TravelProfile } from "@/lib/profile/schema";
import { SEED_DESTINATIONS } from "@/server/destinations/seed-data";
import { SAM } from "../test/fixtures/profiles";
import { createSession, missingConfig, PROMPT_VERSION, toolNames, transcript, type Session } from "./harness";
import { judge } from "./judge";

const KNOWN_DESTINATIONS = SEED_DESTINATIONS.map((d) => d.name);

// Name, citizenship, and home airport known; everything else missing.
const PARTIAL: TravelProfile = { ...emptyProfile, name: "Sam", citizenship: "US", homeAirport: "SFO" };

// Collected per scenario and written to evals/results/ for comparing prompt versions.
const results: { scenario: string; pass: boolean; reason: string }[] = [];

async function expectJudged(scenario: string, session: Session, criteria: string[], profile?: TravelProfile) {
  const verdict = await judge({ criteria, transcript: transcript(session), profile });
  results.push({ scenario, ...verdict });
  expect(verdict.pass, `${verdict.reason}\n\n${transcript(session)}`).toBe(true);
}

function record(scenario: string, pass: boolean, reason: string) {
  results.push({ scenario, pass, reason });
}

afterAll(() => {
  if (results.length === 0) return;
  mkdirSync("evals/results", { recursive: true });
  const passed = results.filter((r) => r.pass).length;
  const file = `evals/results/${PROMPT_VERSION}.json`;
  writeFileSync(file, JSON.stringify({ promptVersion: PROMPT_VERSION, passed, total: results.length, results }, null, 2));
});

describe.skipIf(missingConfig)(`behaviors (prompt ${PROMPT_VERSION})`, () => {
  describe("fills profile gaps proactively", () => {
    it("opens by asking about the user's travel preferences", async () => {
      const session = createSession();
      await session.send("Hi!");
      await expectJudged(
        "gaps: greeting",
        session,
        ["The assistant asks the user about at least one profile detail (e.g. name, home airport, budget, interests, destinations)."],
        emptyProfile,
      );
    });

    it("saves what the user shares, then asks about something still missing", async () => {
      const session = createSession(PARTIAL);
      const turn = await session.send("We really love food when we travel.");
      expect(session.profile().interests.map((i) => i.toLowerCase())).toContain("food");
      expect(toolNames(turn)).toContain("updateProfile");
      await expectJudged(
        "gaps: follow-up",
        session,
        [
          "The assistant acknowledges the food interest.",
          "The assistant asks about a profile detail that isn't saved yet (anything other than name, citizenship, or home airport).",
          "It asks at most one or two questions, not a long list.",
        ],
        PARTIAL,
      );
    });

    it("lets the user steer instead of forcing profile questions", async () => {
      const session = createSession(PARTIAL);
      const turn = await session.send("Can you tell me about Lisbon? I don't want to do profile stuff right now.");
      expect(toolNames(turn)).toContain("getDestinationInfo");
      await expectJudged(
        "gaps: user steers",
        session,
        [
          "The assistant answers the question about Lisbon.",
          "The assistant does not push the user to fill out their profile in this reply.",
        ],
        PARTIAL,
      );
    });
  });

  describe("stays on topic and uses only known information", () => {
    it("declines unrelated requests and steers back to travel", async () => {
      const session = createSession(PARTIAL);
      await session.send("Can you write me a cover letter for a software job?");
      await expectJudged("on-topic: off-topic request", session, [
        "The assistant does not write a cover letter or any part of one.",
        "The assistant redirects to travel planning.",
      ]);
    });

    it("says it has no data on an unknown destination instead of inventing facts", async () => {
      const session = createSession(PARTIAL);
      await session.send("What are the best tango clubs in Buenos Aires?");
      await expectJudged("on-topic: unknown destination", session, [
        "The assistant says it doesn't have information on Buenos Aires.",
        "The assistant does not name any tango clubs, venues, neighborhoods, or other specific facts about Buenos Aires.",
      ]);
    });

    // Not the prompt's worked example, to check the rule generalizes.
    it("handles an unknown destination it wasn't shown an example of", async () => {
      const session = createSession(PARTIAL);
      await session.send("Where are the best jazz bars in Berlin?");
      await expectJudged("on-topic: unknown destination (unseen)", session, [
        "The assistant says it doesn't have information on Berlin.",
        "The assistant does not name any bars, venues, neighborhoods, or other specific facts about Berlin.",
      ]);
    });

    it("doesn't invent details its destination data doesn't have", async () => {
      const session = createSession(PARTIAL);
      await session.send("What's the single best restaurant in Tokyo?");
      await expectJudged("on-topic: missing detail", session, [
        "The assistant does not name any specific restaurant, chef, or street.",
        "The assistant makes clear it can't recommend specific restaurants (it may share what its destination data says about Tokyo).",
      ]);
    });
  });

  describe("limits itself to known destinations", () => {
    it("lists known destinations for a general query", async () => {
      const session = createSession(PARTIAL);
      const turn = await session.send("Where should we go for a hiking trip?");
      expect(toolNames(turn)).toContain("listDestinations");
      await expectJudged("destinations: general query", session, [
        `Every destination the assistant recommends is from this list: ${KNOWN_DESTINATIONS.join(", ")}.`,
        "At least one recommendation is a place the list is known for hiking (Cusco or Reykjavik).",
      ]);
    });
  });

  describe("handles conflicts", () => {
    it("raises a conflict for an overwrite and asks, without changing the profile", async () => {
      const session = createSession(SAM);
      const turn = await session.send("My home airport is OAK.");
      expect(toolNames(turn)).toContain("updateProfile");
      expect(session.profile().homeAirport).toBe("SFO");
      expect(session.pendingConflicts().map((c) => c.field)).toEqual(["homeAirport"]);
      await expectJudged("conflicts: overwrite", session, [
        "The assistant asks whether the home airport should be SFO or OAK.",
        "The assistant does not claim the airport was already changed.",
      ]);
    });

    it("resolves the conflict once the user answers", async () => {
      const session = createSession(SAM);
      await session.send("My home airport is OAK.");
      const turn = await session.send("OAK is right, we just moved.");
      expect(toolNames(turn)).toContain("resolveConflict");
      expect(session.profile().homeAirport).toBe("OAK");
      expect(session.pendingConflicts()).toEqual([]);
      record("conflicts: resolution", true, "resolveConflict applied OAK");
    });

    it("applies an explicit replacement without a conflict", async () => {
      const session = createSession(SAM);
      await session.send("Please change my home airport to OAK, it replaces SFO.");
      expect(session.profile().homeAirport).toBe("OAK");
      expect(session.pendingConflicts()).toEqual([]);
      record("conflicts: explicit replacement", true, "userConfirmed applied OAK");
    });

    it("catches a contradiction across turns that field updates would miss", async () => {
      const session = createSession(PARTIAL);
      await session.send("I never want to go back to Japan. Put it on my avoid list.");
      expect(session.profile().avoid.map((a) => a.toLowerCase())).toContain("japan");

      await session.send("Tokyo is my dream trip, add it to my wishlist!");
      expect(session.profile().wishlist.map((w) => w.toLowerCase())).not.toContain("tokyo");
      expect(session.pendingConflicts().map((c) => c.field)).toContain("wishlist");
      await expectJudged("conflicts: list contradiction", session, [
        "In its last reply, the assistant points out that Tokyo is in Japan, which the user wants to avoid.",
        "It asks the user which they want, rather than deciding for them.",
      ]);
    });

    it("flags a reversal of a saved interest instead of keeping both", async () => {
      const session = createSession({ ...PARTIAL, interests: ["hiking", "food"] });
      await session.send("Honestly I can't stand hiking.");
      const profile = session.profile();
      const keepsBoth =
        profile.interests.some((i) => i.toLowerCase() === "hiking") &&
        profile.avoid.some((a) => a.toLowerCase() === "hiking");
      expect(keepsBoth, "profile lists hiking as both an interest and something to avoid").toBe(false);
      expect(session.pendingConflicts().length).toBeGreaterThan(0);
      await expectJudged("conflicts: reversal", session, [
        "The assistant notices this contradicts hiking being saved as an interest.",
        "It asks the user to confirm rather than silently changing the profile.",
      ]);
    });
  });

  describe("wraps up when the profile is complete", () => {
    it("says the profile is complete and offers changes instead of asking for more", async () => {
      const session = createSession(SAM);
      await session.send("Is there anything else you need from me?");
      await expectJudged(
        "complete: end state",
        session,
        [
          "The assistant says the profile is complete or that it has everything it needs.",
          "It lets the user know they can change or update anything (now or later).",
          "It does not ask the user for new profile information.",
          "It ends on a friendly note (e.g. wishing them happy travels).",
        ],
        SAM,
      );
    });
  });
});

if (missingConfig) {
  describe("behaviors", () => {
    it.skip(`skipped: ${missingConfig}`, () => {});
  });
}
