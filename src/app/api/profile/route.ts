import { connection } from "next/server";
import { redactProfile } from "@/lib/profile/redact";
import { emptyProfile } from "@/lib/profile/schema";
import { getServices } from "@/server/services";

// The profile is read-only over HTTP: users change it through the chat, so
// every write goes through conflict detection. Responses mask document numbers.

export async function GET() {
  // node:sqlite is synchronous, so without this Next would run the query
  // during prerendering and serve a stale profile.
  await connection();
  return Response.json({ profile: redactProfile(getServices().conflictService.getProfile()) });
}

// Development reset: clears the profile and any pending conflicts.
export async function DELETE() {
  getServices().conflictService.resetProfile();
  return Response.json({ profile: emptyProfile });
}
