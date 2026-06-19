import { headers } from "next/headers";
import { isRootHost, normalizeHost } from "./host-resolver";
import { APP_URL } from "./app-url";

/**
 * Build a storefront URL aware of the active host.
 *
 * - When the current request is on the creator's custom domain (host !== root),
 *   returns a slug-less path: `/practice`
 * - On the root domain, returns the canonical `/${creator.slug}/practice`
 *
 * Always returns a *path* (no scheme/host). Use `creatorAbsoluteUrl` for absolute.
 */
export async function creatorUrl(
  creator: { slug: string; customDomain: string | null },
  path: string = "/",
): Promise<string> {
  const safePath = path.startsWith("/") ? path : `/${path}`;
  const onCustom = await onCustomDomainFor(creator);
  if (onCustom) {
    return safePath === "/" ? "/" : safePath;
  }
  return safePath === "/" ? `/${creator.slug}` : `/${creator.slug}${safePath}`;
}

/**
 * Absolute URL — useful for emails, OG tags, share links.
 * Prefers the custom domain if set + active; otherwise the canonical root URL.
 */
export function creatorAbsoluteUrl(
  creator: {
    slug: string;
    customDomain: string | null;
    customDomainStatus: string | null;
  },
  path: string = "/",
): string {
  const safePath = path.startsWith("/") ? path : `/${path}`;
  if (
    creator.customDomain &&
    (creator.customDomainStatus === "verified" || creator.customDomainStatus === "active")
  ) {
    return `https://${creator.customDomain}${safePath === "/" ? "" : safePath}`;
  }
  return `${APP_URL}/${creator.slug}${safePath === "/" ? "" : safePath}`;
}

/** True when the current request is on this creator's verified custom domain. */
export async function onCustomDomainFor(creator: {
  customDomain: string | null;
}): Promise<boolean> {
  if (!creator.customDomain) return false;
  const h = normalizeHost((await headers()).get("host"));
  if (!h || isRootHost(h)) return false;
  return h === normalizeHost(creator.customDomain);
}
