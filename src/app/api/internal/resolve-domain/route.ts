import { NextRequest, NextResponse } from "next/server";
import { lookupVerifiedCreatorSlugByNormalizedHost } from "@/lib/domain-lookup";
import { getDomainLookupSecret } from "@/lib/domain-lookup-auth";
import { normalizeHost } from "@/lib/host-resolver";

export async function GET(req: NextRequest) {
  const expected = getDomainLookupSecret();
  if (!expected || req.headers.get("x-middleware-domain-lookup") !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = req.nextUrl.searchParams.get("host");
  if (!raw) {
    return NextResponse.json({ slug: null });
  }

  const h = normalizeHost(raw);
  if (!h) {
    return NextResponse.json({ slug: null });
  }

  const slug = await lookupVerifiedCreatorSlugByNormalizedHost(h);
  return NextResponse.json({ slug });
}
