import {
  invalidateDomainLookupCache,
  lookupVerifiedCreatorSlugByNormalizedHost,
} from "./domain-lookup";

/**
 * host → creator slug resolution (Node / server contexts). Middleware uses
 * `/api/internal/resolve-domain` instead so Edge never bundles Prisma.
 *
 * Cache lives in `domain-lookup.ts` (60s TTL).
 */

const ROOT_DOMAIN_FALLBACK = "localhost:3000";

function getRootDomain(): string {
  return (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? ROOT_DOMAIN_FALLBACK).toLowerCase();
}

/** Normalize a Host header for comparison: strip port, lowercase, drop trailing dot. */
export function normalizeHost(host: string | null | undefined): string {
  if (!host) return "";
  return host.toLowerCase().replace(/\.$/, "");
}

export function isRootHost(host: string): boolean {
  const root = getRootDomain();
  const h = normalizeHost(host);
  if (h === root || h === `www.${root}`) return true;
  // localhost variants
  if (h.startsWith("localhost") || h.startsWith("127.0.0.1") || h.startsWith("0.0.0.0")) return true;
  // Vercel preview deploys (always treated as root)
  if (h.endsWith(".vercel.app")) return true;
  return false;
}

/**
 * Returns the creator slug for a custom-domain host, or null if the host
 * is the root domain / unknown.
 */
export async function getCreatorSlugForHost(host: string | null | undefined): Promise<string | null> {
  const h = normalizeHost(host);
  if (!h || isRootHost(h)) return null;
  return lookupVerifiedCreatorSlugByNormalizedHost(h);
}

/** Manually invalidate the cache for a host (e.g. when domain status changes). */
export function invalidateHostCache(host: string): void {
  invalidateDomainLookupCache(normalizeHost(host));
}
