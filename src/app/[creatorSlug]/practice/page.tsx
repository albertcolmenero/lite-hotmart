import Link from "next/link";
import { notFound } from "next/navigation";
import { Search, ArrowRight } from "lucide-react";
import { db } from "@/lib/db";
import { getOrCreateDbUser } from "@/lib/auth";
import { hasActiveSubscription } from "@/lib/entitlements";
import { ClassCard, SeriesCard } from "@/components/cards";
import { PosterFold, StackedBooks } from "@/components/illustrations";

export default async function PracticePage({
  params,
}: {
  params: Promise<{ creatorSlug: string }>;
}) {
  const { creatorSlug } = await params;
  const creator = await db.creator.findUnique({
    where: { slug: creatorSlug },
    include: { plan: true },
  });
  if (!creator) notFound();

  const viewer = await getOrCreateDbUser();
  const subscribed = viewer ? await hasActiveSubscription(viewer.id, creator.id) : false;
  const isOwner = viewer?.id === creator.userId;
  const standaloneFilter = isOwner ? {} : { standalone: true };

  const paywall = {
    creatorId: creator.id,
    creatorName: creator.displayName,
    creatorAccent: creator.accentColor,
    plan: creator.plan
      ? {
          monthlyPriceCents: creator.plan.monthlyPriceCents,
          yearlyPriceCents: creator.plan.yearlyPriceCents,
          currency: creator.plan.currency,
        }
      : null,
    signedIn: Boolean(viewer),
  };

  const visibilityFilter = subscribed
    ? {}
    : { OR: [{ visibleToPublic: true }, { freeForEveryone: true }] };

  const [classes, seriesList] = await Promise.all([
    db.class.findMany({
      where: { creatorId: creator.id, published: true, ...visibilityFilter, ...standaloneFilter },
      orderBy: { publishedAt: "desc" },
      take: 6,
    }),
    db.series.findMany({
      where: { creatorId: creator.id, published: true, ...visibilityFilter },
      orderBy: { publishedAt: "desc" },
      include: { _count: { select: { classes: true } } },
      take: 6,
    }),
  ]);

  return (
    <div className="max-w-[1180px] mx-auto px-6 py-12 space-y-14">
      <header>
        <h1 className="text-h1">Practice</h1>
        <p className="mt-2" style={{ color: "var(--lichen)" }}>
          Every-day classes and practice series.
        </p>
      </header>

      <CatalogSection title="Classes" viewAllHref={`/${creator.slug}/practice?tab=classes`}>
        {classes.length === 0 ? (
          <EmptyRow message="No classes published yet." illustration={<PosterFold />} />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {classes.map((c) => (
              <ClassCard
                key={c.id}
                creatorSlug={creator.slug}
                cls={{
                  slug: c.slug,
                  title: c.title,
                  durationMins: c.durationMins,
                  thumbnailUrl: c.thumbnailUrl,
                  videoUrl: c.videoUrl,
                }}
                locked={!subscribed && !c.freeForEveryone}
                paywall={paywall}
              />
            ))}
          </div>
        )}
      </CatalogSection>

      <CatalogSection title="Series" viewAllHref={`/${creator.slug}/practice?tab=series`}>
        {seriesList.length === 0 ? (
          <EmptyRow message="No series published yet." illustration={<StackedBooks />} />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {seriesList.map((s) => (
              <SeriesCard
                key={s.id}
                creatorSlug={creator.slug}
                series={{ slug: s.slug, title: s.title, coverUrl: s.coverUrl }}
                classCount={s._count.classes}
                locked={!subscribed && !s.freeForEveryone}
              />
            ))}
          </div>
        )}
      </CatalogSection>

      <section>
        <Link
          href="#search"
          className="card card-pop hover:card-lift group block p-5 flex items-center gap-4 transition-shadow"
        >
          <div
            className="w-10 h-10 rounded-md flex items-center justify-center shrink-0"
            style={{ background: "var(--stone)", color: "var(--ink)" }}
          >
            <Search size={18} strokeWidth={1.75} />
          </div>
          <div className="flex-1">
            <div className="font-medium" style={{ color: "var(--ink)" }}>
              Search all classes
            </div>
            <div className="text-sm mt-0.5" style={{ color: "var(--lichen)" }}>
              Filter by length, level, focus, and goal.
            </div>
          </div>
          <ArrowRight
            size={18}
            strokeWidth={1.75}
            className="shrink-0 transition-transform duration-300 group-hover:translate-x-0.5"
            style={{ color: "var(--ink)" }}
          />
        </Link>
      </section>
    </div>
  );
}

function CatalogSection({
  title,
  viewAllHref,
  children,
}: {
  title: string;
  viewAllHref: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-end justify-between mb-5">
        <h2 className="text-h2">{title}</h2>
        <Link
          href={viewAllHref}
          className="text-sm font-medium hover:underline"
          style={{ color: "var(--ink)", textUnderlineOffset: 3 }}
        >
          View all →
        </Link>
      </div>
      {children}
    </section>
  );
}

function EmptyRow({
  message,
  illustration,
}: {
  message: string;
  illustration: React.ReactNode;
}) {
  return (
    <div className="card p-10 text-center">
      <div className="mx-auto" style={{ maxWidth: 160 }}>
        {illustration}
      </div>
      <p className="mt-3 text-sm" style={{ color: "var(--lichen)" }}>{message}</p>
    </div>
  );
}
