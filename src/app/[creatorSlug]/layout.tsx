import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getOrCreateDbUser } from "@/lib/auth";
import { hasActiveSubscription } from "@/lib/entitlements";
import { StorefrontHeader } from "@/components/storefront-header";
import { PreviewBanner } from "@/components/preview-banner";
import { getResolvedMenuForCreator } from "@/lib/menu";

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

  const tabs = await getResolvedMenuForCreator(creator.id, creator.slug);
  const isMember = viewer ? await hasActiveSubscription(viewer.id, creator.id) : false;

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-white">
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
