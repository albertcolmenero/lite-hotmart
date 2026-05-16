import { db } from "./db";

/**
 * host → creator slug resolution, with a small in-memory cache.
 *
 * Called from middleware (every public request) and from any helper that
 * needs to detect the "we're on a custom domain" condition (`creator-url.ts`).
 *
 * Cache is intentionally tiny (60s TTL) — domain mappings change rarely;
 * if a creator changes their domain, worst-case latency is 60s before
 * traffic flips. We still serve correctly because we revalidate on miss.
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

type CacheEntry = { slug: string | null; expiresAt: number };
const TTL_MS = 60_000;
const cache = new Map<string, CacheEntry>();

/**
 * Returns the creator slug for a custom-domain host, or null if the host
 * is the root domain / unknown.
 */
export async function getCreatorSlugForHost(host: string | null | undefined): Promise<string | null> {
  const h = normalizeHost(host);
  if (!h || isRootHost(h)) return null;

  const now = Date.now();
  const cached = cache.get(h);
  if (cached && cached.expiresAt > now) return cached.slug;

  const creator = await db.creator.findUnique({
    where: { customDomain: h },
    select: { slug: true, customDomainStatus: true },
  });
  // Only serve traffic when the domain is verified or active. `pending_dns` /
  // `pending_verification` shouldn't render the storefront yet.
  const slug =
    creator && (creator.customDomainStatus === "verified" || creator.customDomainStatus === "active")
      ? creator.slug
      : null;

  cache.set(h, { slug, expiresAt: now + TTL_MS });
  return slug;
}

/** Manually invalidate the cache for a host (e.g. when domain status changes). */
export function invalidateHostCache(host: string): void {
  cache.delete(normalizeHost(host));
}
