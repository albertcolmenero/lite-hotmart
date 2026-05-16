import { db } from "./db";

type CacheEntry = { slug: string | null; expiresAt: number };
const TTL_MS = 60_000;
const cache = new Map<string, CacheEntry>();

/**
 * DB-backed host → slug for verified/active custom domains only.
 * `normalizedHost` must already be lowercase etc. (use `normalizeHost` from host-resolver).
 */
export async function lookupVerifiedCreatorSlugByNormalizedHost(
  normalizedHost: string,
): Promise<string | null> {
  const now = Date.now();
  const cached = cache.get(normalizedHost);
  if (cached && cached.expiresAt > now) return cached.slug;

  const creator = await db.creator.findUnique({
    where: { customDomain: normalizedHost },
    select: { slug: true, customDomainStatus: true },
  });
  const slug =
    creator && (creator.customDomainStatus === "verified" || creator.customDomainStatus === "active")
      ? creator.slug
      : null;

  cache.set(normalizedHost, { slug, expiresAt: now + TTL_MS });
  return slug;
}

export function invalidateDomainLookupCache(normalizedHost: string): void {
  cache.delete(normalizedHost);
}
