import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { CSSProperties } from "react";
import { db } from "@/lib/db";
import { getOrCreateDbUser } from "@/lib/auth";
import { hasActiveSubscription } from "@/lib/entitlements";
import { isRootHost, normalizeHost } from "@/lib/host-resolver";
import { StorefrontHeader } from "@/components/storefront-header";
import { PreviewBanner } from "@/components/preview-banner";
import { getResolvedMenuForCreator } from "@/lib/menu";
import { getTheme } from "@/lib/themes";

export default async function StorefrontLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ creatorSlug: string }>;
}) {
  const { creatorSlug } = await params;
  const creator = await db.creator.findUnique({ where: { slug: creatorSlug } });
  if (!creator) notFound();

  const viewer = await getOrCreateDbUser();
  const isOwner = viewer?.id === creator.userId;
  if (!creator.published && !isOwner) notFound();

  // Canonical redirect: a SIGNED-OUT visitor hitting the root domain for a
  // creator with an active custom domain is sent to that domain (sub-path
  // preserved). Signed-in users stay on root — that's where their Clerk session
  // (and unlocked content) lives; the custom domain is public-only until Clerk
  // satellite domains. So owners AND subscribers are never bounced off root.
  const hdrs = await headers();
  const host = normalizeHost(hdrs.get("host"));
  if (
    host &&
    isRootHost(host) &&
    creator.published &&
    !viewer &&
    creator.customDomain &&
    creator.customDomainStatus === "active"
  ) {
    const prefix = `/${creator.slug}`;
    const pathname = hdrs.get("x-pathname") ?? prefix;
    const sub = pathname.startsWith(prefix + "/") ? pathname.slice(prefix.length) : "";
    redirect(`https://${creator.customDomain}${sub}`);
  }

  const tabs = await getResolvedMenuForCreator(creator.id, creator.slug);
  const isMember = viewer ? await hasActiveSubscription(viewer.id, creator.id) : false;
  const theme = getTheme(creator.themeId);

  return (
    <div
      className="flex-1 flex flex-col min-h-screen"
      style={{ ...theme.vars, background: "var(--surface)" } as CSSProperties}
    >
      {isOwner && !creator.published ? <PreviewBanner /> : null}
      <StorefrontHeader
        creatorSlug={creator.slug}
        accentColor={creator.accentColor}
        logoUrl={creator.logoUrl}
        tabs={tabs}
        isMember={isMember}
      />
      <main className="flex-1">{children}</main>
    </div>
  );
}
