/**
 * Canonical absolute origin for this app, e.g. "https://www.lite-creator.com".
 *
 * Sourced from NEXT_PUBLIC_APP_URL (falls back to localhost in dev). Any trailing
 * slash is stripped so callers can safely build `${APP_URL}/path` without emitting
 * a double slash. That matters most for Stripe's OAuth `redirect_uri`, which Stripe
 * matches byte-for-byte against the registered URIs — a `//` there is a hard
 * failure, not a cosmetic one. Pure module (env read + string op), so it is safe to
 * import from edge middleware.
 */
export const APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
).replace(/\/+$/, "");
