import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { IS_DEV_BYPASS } from "./lib/dev-auth";
import { getDomainLookupSecret } from "./lib/domain-lookup-auth";
import { isRootHost } from "./lib/host-resolver";

const isProtectedRoute = createRouteMatcher([
  "/studio(.*)",
  "/library(.*)",
  "/onboarding(.*)",
]);

/** Paths that must never serve from a custom domain — they belong on the root. */
const ROOT_ONLY_PREFIXES = [
  "/studio",
  "/library",
  "/onboarding",
  "/sign-in",
  "/sign-up",
  "/api",
];

function isRootOnlyPath(pathname: string): boolean {
  return ROOT_ONLY_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function rootOrigin(): string {
  const env = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return env.replace(/\/$/, "");
}

/** Canonical server origin for internal middleware fetches (never the request Host when on custom domains). */
function middlewareLookupBase(): string | null {
  const fromPublic = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (fromPublic) return fromPublic;
  const vercel = process.env.VERCEL_URL?.replace(/\/$/, "");
  if (vercel) return `https://${vercel}`;
  if (process.env.NODE_ENV === "development") return "http://localhost:3000";
  return null;
}

/**
 * Edge middleware cannot import Prisma. Resolve custom domain → slug via a
 * Node route. Must always call the app's canonical origin — never use the
 * incoming `Host`, or the fetch loops back through this middleware.
 */
async function getCreatorSlugForHostEdge(host: string): Promise<string | null> {
  const secret = getDomainLookupSecret();
  if (!secret) {
    console.error(
      "MIDDLEWARE_DOMAIN_LOOKUP_SECRET is required for custom domains in production",
    );
    return null;
  }

  const base = middlewareLookupBase();
  if (!base) {
    console.error(
      "Set NEXT_PUBLIC_APP_URL or rely on VERCEL_URL (Vercel) for custom-domain resolution",
    );
    return null;
  }

  const url = new URL("/api/internal/resolve-domain", base);
  url.searchParams.set("host", host);

  const res = await fetch(url, {
    headers: { "x-middleware-domain-lookup": secret },
    cache: "no-store",
  });

  if (!res.ok) return null;
  const data = (await res.json()) as { slug?: string | null };
  return data.slug ?? null;
}

const clerkHandler = clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export default async function middleware(
  req: NextRequest,
  ev: Parameters<typeof clerkHandler>[1],
) {
  const url = req.nextUrl;
  const host = req.headers.get("host");

  // Custom-domain branch — only meaningful for the storefront surface.
  if (host && !isRootHost(host)) {
    const slug = await getCreatorSlugForHostEdge(host);

    if (!slug) {
      // Unknown host → fail closed.
      return new NextResponse("Not Found", { status: 404 });
    }

    // Root-only paths should never serve from a custom domain → bounce to root.
    if (isRootOnlyPath(url.pathname)) {
      const target = new URL(`${rootOrigin()}${url.pathname}${url.search}`);
      return NextResponse.redirect(target, { status: 308 });
    }

    // If the request already includes the /{slug}/... prefix (e.g. a stale
    // link rendered before we shipped the URL helper), strip it. Redirect so
    // the browser URL becomes clean.
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

  // Root-domain branch — existing Clerk auth flow.
  if (IS_DEV_BYPASS) return NextResponse.next();
  return clerkHandler(req, ev);
}

export const config = {
  matcher: [
    "/((?!_next|.*\\..*).*)",
    "/(api|trpc)(.*)",
  ],
};
