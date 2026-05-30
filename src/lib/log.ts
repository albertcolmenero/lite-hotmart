type Level = "info" | "warn" | "error";

/**
 * Minimal structured logger. Emits one JSON line per call so Vercel's log
 * viewer (and any log drain) can parse and filter by field. Prefer this over
 * bare console.* in API routes, webhooks, and payment code paths where
 * post-incident debugging matters.
 *
 * Timestamps are omitted on purpose — the platform log layer stamps each line.
 */
export function log(
  level: Level,
  msg: string,
  context: Record<string, unknown> = {},
): void {
  const line = JSON.stringify({ level, msg, ...context });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}
