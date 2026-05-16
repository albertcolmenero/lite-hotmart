import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { IS_DEV_BYPASS } from "./lib/dev-auth";
import { getCreatorSlugForHost, isRootHost } from "./lib/host-resolver";

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
    const slug = await getCreatorSlugForHost(host);

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
