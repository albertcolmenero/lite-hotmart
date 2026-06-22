import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { IS_DEV_BYPASS } from "./lib/dev-auth";
import { getDomainLookupSecret } from "./lib/domain-lookup-auth";
import { isRootHost } from "./lib/host-resolver";
import { APP_URL } from "./lib/app-url";

const isProtectedRoute = createRouteMatcher([
  "/studio(.*)",
  "/studio-select(.*)",
  "/library(.*)",
  "/onboarding(.*)",
]);

/** Paths that must never serve from a custom domain — they belong on the root. */
const ROOT_ONLY_PREFIXES = [
  "/studio",
  "/studio-select",
  "/library",
  "/onboarding",
  "/sign-in",
  "/sign-up",
  "/api",
];

function isRootOnlyPath(pathname: string): boolean {
  return ROOT_ONLY_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Canonical server origin for internal middleware fetches (never the request Host when on custom domains). */
function middlewareLookupBase(): string | null {
  // Prefer the configured app origin; fall back to VERCEL_URL only when it is unset.
  if (process.env.NEXT_PUBLIC_APP_URL) return APP_URL;
  const vercel = process.env.VERCEL_URL?.replace(/\/+$/, "");
  if (vercel) return `https://${vercel}`;
  if (process.env.NODE_ENV === "development") return "http://localhost:3000";
  return null;
}

type LookupResult =
  | { ok: true; slug: string; trace: string[] }
  | { ok: false; reason: string; trace: string[] };

async function getCreatorSlugForHostEdge(host: string): Promise<LookupResult> {
  const trace: string[] = [];
  const push = (s: string) => trace.push(s);

  push(`host=${host}`);
  push(`NEXT_PUBLIC_ROOT_DOMAIN=${process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "(unset)"}`);
  push(`NEXT_PUBLIC_APP_URL=${process.env.NEXT_PUBLIC_APP_URL ?? "(unset)"}`);
  push(`VERCEL_URL=${process.env.VERCEL_URL ?? "(unset)"}`);
  push(`NODE_ENV=${process.env.NODE_ENV}`);

  const secret = getDomainLookupSecret();
  push(`secret_set=${Boolean(secret)} (len=${secret?.length ?? 0})`);
  if (!secret) {
    return { ok: false, reason: "MIDDLEWARE_DOMAIN_LOOKUP_SECRET not set", trace };
  }

  const base = middlewareLookupBase();
  push(`lookup_base=${base ?? "(null)"}`);
  if (!base) {
    return {
      ok: false,
      reason: "no lookup base — set NEXT_PUBLIC_APP_URL (with https://) or rely on VERCEL_URL",
      trace,
    };
  }

  let url: URL;
  try {
    url = new URL("/api/internal/resolve-domain", base);
  } catch (err) {
    return {
      ok: false,
      reason: `invalid lookup base "${base}" — must include scheme. ${(err as Error).message}`,
      trace,
    };
  }
  url.searchParams.set("host", host);
  push(`lookup_url=${url.toString()}`);

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "x-middleware-domain-lookup": secret },
      cache: "no-store",
    });
  } catch (err) {
    return {
      ok: false,
      reason: `fetch threw: ${(err as Error).message}`,
      trace,
    };
  }
  push(`lookup_status=${res.status}`);

  if (!res.ok) {
    const body = await res.text().catch(() => "(unreadable)");
    push(`lookup_body=${body.slice(0, 200)}`);
    return { ok: false, reason: `lookup endpoint returned ${res.status}`, trace };
  }

  let data: { slug?: string | null } | null;
  try {
    data = await res.json();
  } catch {
    return { ok: false, reason: "lookup response was not valid JSON", trace };
  }
  push(`lookup_json=${JSON.stringify(data)}`);

  if (!data?.slug) {
    return {
      ok: false,
      reason: `no verified Creator row matches host "${host}". Check Creator.customDomain + customDomainStatus in the DB (must be "verified" or "active").`,
      trace,
    };
  }

  return { ok: true, slug: data.slug, trace };
}

function diagnosticResponse(host: string, result: { reason: string; trace: string[] }): NextResponse {
  const body = JSON.stringify(
    {
      error: "Custom domain not resolved",
      host,
      reason: result.reason,
      trace: result.trace,
      hint:
        "Check (1) Vercel env vars NEXT_PUBLIC_ROOT_DOMAIN / NEXT_PUBLIC_APP_URL / MIDDLEWARE_DOMAIN_LOOKUP_SECRET, " +
        "(2) that the domain is attached in Vercel → Settings → Domains, " +
        "(3) that the DB has a Creator row with customDomain matching this host and customDomainStatus in ('verified','active'). " +
        "Run `pnpm check:domain " + host + "` locally to inspect the DB.",
    },
    null,
    2,
  );
  return new NextResponse(body, {
    status: 404,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "x-domain-lookup": "failed",
    },
  });
}

/**
 * Single clerkMiddleware that handles BOTH branches.
 *
 * Why: when a custom-domain request hits us, we must still go through
 * clerkMiddleware so its headers get attached to whatever response we return.
 * Otherwise downstream pages that call `auth()` panic with
 *   "auth() was called but Clerk can't detect usage of clerkMiddleware()"
 *
 * Pattern: do the custom-domain rewrite *inside* the clerkMiddleware callback.
 * Clerk merges its headers into our NextResponse before returning it.
 */
const clerkHandler = clerkMiddleware(async (auth, req) => {
  const url = req.nextUrl;
  const host = req.headers.get("host");

  // ─────────────────────────── Custom-domain branch
  if (host && !isRootHost(host)) {
    const result = await getCreatorSlugForHostEdge(host);

    if (!result.ok) {
      console.error("[middleware] custom-domain lookup failed", {
        host,
        reason: result.reason,
        trace: result.trace,
      });
      return diagnosticResponse(host, result);
    }

    const slug = result.slug;

    // Root-only paths should never serve from a custom domain → bounce to root.
    if (isRootOnlyPath(url.pathname)) {
      const target = new URL(`${APP_URL}${url.pathname}${url.search}`);
      return NextResponse.redirect(target, { status: 308 });
    }

    // If the request already includes the /{slug}/... prefix, strip it.
    if (url.pathname === `/${slug}` || url.pathname.startsWith(`/${slug}/`)) {
      const stripped = url.pathname === `/${slug}` ? "/" : url.pathname.slice(slug.length + 1);
      const cleaned = new URL(stripped + url.search, url);
      return NextResponse.redirect(cleaned, { status: 308 });
    }

    // Rewrite "/practice" → "/{slug}/practice" so existing routes serve unchanged.
    const rewritten = url.clone();
    rewritten.pathname =
      url.pathname === "/" ? `/${slug}` : `/${slug}${url.pathname}`;
    return NextResponse.rewrite(rewritten);
  }

  // ─────────────────────────── Root-domain branch
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
  // Expose the request path to server components — the storefront layout reads
  // it to build the canonical redirect to a creator's custom domain.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", url.pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
});

export default async function middleware(
  req: NextRequest,
  ev: Parameters<typeof clerkHandler>[1],
) {
  // Dev bypass short-circuits Clerk entirely (no Clerk env required locally).
  if (IS_DEV_BYPASS) return NextResponse.next();
  return clerkHandler(req, ev);
}

export const config = {
  matcher: [
    "/((?!_next|.*\\..*).*)",
    "/(api|trpc)(.*)",
  ],
};
