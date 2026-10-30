import type { ConflictErrorCode } from "@/server/conflicts/conflict-service";

const STATUS_BY_CODE: Record<ConflictErrorCode, number> = {
  invalid: 400,
  not_found: 404,
  not_pending: 409,
  same_turn: 409,
  stale: 409,
};

export function conflictErrorResponse({ code, error }: { code: ConflictErrorCode; error: string }) {
  return Response.json({ code, error }, { status: STATUS_BY_CODE[code] });
}
