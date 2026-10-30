import "server-only";

export type LogLevel = "info" | "warn" | "error";

// One JSON object per line on stdout (stderr for errors), so logs can be
// piped into any log tool. Callers must not pass secrets. LOG_LEVEL=silent
// turns logging off (evals use it to keep output readable).
export function logEvent(event: string, fields: Record<string, unknown> = {}, level: LogLevel = "info"): void {
  if (process.env.LOG_LEVEL === "silent") return;
  const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...fields });
  if (level === "error") console.error(line);
  else console.log(line);
}
