import { connection } from "next/server";
import { z } from "zod";
import { redactProfile } from "@/lib/profile/redact";
import { emptyProfile, ProfileUpdateSchema } from "@/lib/profile/schema";
import { getDatabase } from "@/server/db/database";
import { createProfileStore } from "@/server/profile/profile-store";

// Responses mask travel document numbers; the UI only displays them.
const getProfileStore = () => createProfileStore(getDatabase());

export async function GET() {
  // node:sqlite is synchronous, so without this Next would run the query
  // during prerendering and serve a stale profile.
  await connection();
  return Response.json({ profile: redactProfile(getProfileStore().get() ?? emptyProfile) });
}

export async function PATCH(req: Request) {
  const body: unknown = await req.json().catch(() => null);
  const parsed = ProfileUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  }
  return Response.json({ profile: redactProfile(getProfileStore().update(parsed.data)) });
}

export async function DELETE() {
  getProfileStore().delete();
  return Response.json({ profile: emptyProfile });
}
