import { z } from "zod";
import { redactConflict, ResolveConflictInputSchema } from "@/lib/conflicts/schema";
import { redactProfile } from "@/lib/profile/redact";
import { getServices } from "@/server/services";
import { conflictErrorResponse } from "../../responses";

// Resolves a pending conflict: { resolution: { type: "keep_existing" |
// "accept_proposed" } | { type: "custom", change } }.
export async function POST(req: Request, ctx: RouteContext<"/api/conflicts/[id]/resolve">) {
  const { id } = await ctx.params;
  const body: unknown = await req.json().catch(() => null);
  const parsed = ResolveConflictInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  }

  const outcome = getServices().conflictService.resolveConflict(id, parsed.data);
  if (!outcome.ok) return conflictErrorResponse(outcome);
  return Response.json({ profile: redactProfile(outcome.profile), conflict: redactConflict(outcome.conflict) });
}
