import { notFound } from "next/navigation";
import { Layers } from "lucide-react";
import { db } from "@/lib/db";
import { getOrCreateDbUser } from "@/lib/auth";
import { hasActiveSubscription } from "@/lib/entitlements";
import { toPlanDisplay } from "@/lib/plan-display";
import { SeriesPlayer } from "./_player";

export default async function SeriesDetailPage({
  params,
}: {
  params: Promise<{ creatorSlug: string; seriesSlug: string }>;
}) {
  const { creatorSlug, seriesSlug } = await params;
  const creator = await db.creator.findUnique({
    where: { slug: creatorSlug },
    include: { plan: { include: { prices: true } } },
  });
  if (!creator) notFound();

  const series = await db.series.findUnique({
    where: { creatorId_slug: { creatorId: creator.id, slug: seriesSlug } },
    include: {
      tags: true,
      classes: { orderBy: { position: "asc" }, include: { classRef: true } },
    },
  });
  if (!series || !series.published) notFound();

  const viewer = await getOrCreateDbUser();
  const subscribed = viewer
    ? await hasActiveSubscription(viewer.id, creator.id)
    : false;
  const isOwner = viewer?.id === creator.userId;
  // Page is reachable when the series is public, or the viewer is subscribed,
  // or it's a fully-free series, or the owner is previewing.
  if (
    !series.visibleToPublic &&
    !subscribed &&
    !isOwner &&
    !series.freeForEveryone
  ) {
    notFound();
  }

  const classes = series.classes.map((sc) => ({
    id: sc.classRef.id,
    slug: sc.classRef.slug,
    title: sc.classRef.title,
    videoProvider: sc.classRef.videoProvider,
    videoUrl: sc.classRef.videoUrl,
    thumbnailUrl: sc.classRef.thumbnailUrl,
    durationMins: sc.classRef.durationMins,
    freeForEveryone: sc.classRef.freeForEveryone,
  }));

  const paywall = {
    creatorId: creator.id,
    creatorName: creator.displayName,
    creatorAccent: creator.accentColor,
    plan: toPlanDisplay(creator.plan),
    signedIn: Boolean(viewer),
  };

  return (
    <div className="max-w-[1180px] mx-auto px-6 py-10 space-y-6">
      <div className="space-y-2">
        <div
          className="flex items-center gap-2 text-mono-sm"
          style={{ color: "var(--muted)" }}
        >
          <Layers size={14} strokeWidth={1.75} />
          Series
        </div>
        <h1 className="text-h1" style={{ color: "var(--ink)" }}>
          {series.title}
        </h1>
      </div>

      <SeriesPlayer
        classes={classes}
        baseAllowed={subscribed || isOwner}
        seriesFreeForEveryone={series.freeForEveryone}
        paywall={paywall}
        description={series.description}
        tags={series.tags.map((t) => ({ id: t.id, name: t.name }))}
        coverUrl={series.coverUrl}
      />
    </div>
  );
}
