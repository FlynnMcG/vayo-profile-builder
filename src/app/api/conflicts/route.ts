import { connection } from "next/server";
import { z } from "zod";
import { redactConflict, ReportConflictInputSchema } from "@/lib/conflicts/schema";
import { getServices } from "@/server/services";
import { conflictErrorResponse } from "./responses";

// Pending conflicts, with document numbers masked.
export async function GET() {
  await connection(); // sync SQLite read; see /api/profile
  const conflicts = getServices().conflictService.listPending().map(redactConflict);
  return Response.json({ conflicts });
}

// Reports a conflict: holds a proposed change until the user decides.
export async function POST(req: Request) {
  const body: unknown = await req.json().catch(() => null);
  const parsed = ReportConflictInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  }

  const outcome = getServices().conflictService.reportConflict(parsed.data);
  if (!outcome.ok) return conflictErrorResponse(outcome);
  return Response.json({ conflict: redactConflict(outcome.conflict) }, { status: 201 });
}
