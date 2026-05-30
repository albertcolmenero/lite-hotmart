import { log } from "@/lib/log";

/**
 * Single seam for error reporting. Today it emits a structured error log;
 * wiring a provider (e.g. Sentry) later is a one-place change here instead of
 * hunting every catch block / error boundary. Safe on both server and client.
 */
export function captureException(
  error: unknown,
  context: Record<string, unknown> = {},
): void {
  const err = error instanceof Error ? error : new Error(String(error));
  log("error", err.message, { ...context, stack: err.stack });
  // TODO(sentry): once @sentry/nextjs is installed + a DSN is set, also call
  //   Sentry.captureException(err, { extra: context })
  // here. Keep this the only integration point.
}
