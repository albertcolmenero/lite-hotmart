import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getOrCreateDbUser } from "@/lib/auth";
import { hasActiveSubscription } from "@/lib/entitlements";
import { toPlanDisplay } from "@/lib/plan-display";
import { ClassCard, SeriesCard, CourseCard } from "@/components/cards";
import { EmptyState } from "@/components/empty-state";
import { BookmarkRibbon } from "@/components/illustrations";

export default async function FavoritesPage({
  params,
}: {
  params: Promise<{ creatorSlug: string }>;
}) {
  const { creatorSlug } = await params;
  const creator = await db.creator.findUnique({
    where: { slug: creatorSlug },
    include: { plan: { include: { prices: true } } },
  });
  if (!creator) notFound();

  const viewer = await getOrCreateDbUser();
  if (!viewer) redirect(`/sign-in?redirect_url=/${creatorSlug}/favorites`);

  const subscribed = await hasActiveSubscription(viewer.id, creator.id);

  const paywall = {
    creatorId: creator.id,
    creatorSlug: creator.slug,
    creatorName: creator.displayName,
    creatorAccent: creator.accentColor,
    plan: toPlanDisplay(creator.plan),
    signedIn: true,
  };

  const favs = await db.favorite.findMany({
    where: { userId: viewer.id },
    orderBy: { createdAt: "desc" },
    include: {
      classRef: true,
      series: {
        include: {
          classes: {
            orderBy: { position: "asc" },
            take: 1,
            include: { classRef: { select: { thumbnailUrl: true, videoUrl: true } } },
          },
        },
      },
      course: true,
    },
  });

  const isOwner = viewer.id === creator.userId;
  const classFavs = favs.filter(
    (f) =>
      f.classRef &&
      f.classRef.creatorId === creator.id &&
      (isOwner || f.classRef.standalone),
  );
  const seriesFavs = favs.filter((f) => f.series && f.series.creatorId === creator.id);
  const courseFavs = favs.filter((f) => f.course && f.course.creatorId === creator.id);

  const empty = classFavs.length === 0 && seriesFavs.length === 0 && courseFavs.length === 0;

  return (
    <div className="max-w-[1180px] mx-auto px-6 py-12 space-y-12">
      <header>
        <h1 className="text-h1">Favorites</h1>
        <p className="mt-2" style={{ color: "var(--lichen)" }}>
          Classes, series and courses you saved for later.
        </p>
      </header>

      {empty ? (
        <EmptyState
          illustration={<BookmarkRibbon />}
          title="Nothing saved yet."
          body="Tap the heart on any class, series, or course and it lands here."
          primary={{ label: "Browse practice", href: `/${creator.slug}/practice` }}
          secondary={{ label: "Browse courses", href: `/${creator.slug}/courses` }}
        />
      ) : null}

      {classFavs.length > 0 ? (
        <Section title="Classes" count={classFavs.length}>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {classFavs.map((f) => (
              <ClassCard
                key={f.id}
                creatorSlug={creator.slug}
                cls={{
                  slug: f.classRef!.slug,
                  title: f.classRef!.title,
                  durationMins: f.classRef!.durationMins,
                  thumbnailUrl: f.classRef!.thumbnailUrl,
                  videoUrl: f.classRef!.videoUrl,
                }}
                locked={!subscribed && !f.classRef!.freeForEveryone}
                paywall={paywall}
              />
            ))}
          </div>
        </Section>
      ) : null}

      {seriesFavs.length > 0 ? (
        <Section title="Series" count={seriesFavs.length}>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {seriesFavs.map((f) => (
              <SeriesCard
                key={f.id}
                creatorSlug={creator.slug}
                series={{
                  slug: f.series!.slug,
                  title: f.series!.title,
                  coverUrl: f.series!.coverUrl,
                  firstClass: f.series!.classes[0]?.classRef ?? null,
                }}
                classCount={0}
              />
            ))}
          </div>
        </Section>
      ) : null}

      {courseFavs.length > 0 ? (
        <Section title="Courses" count={courseFavs.length}>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {courseFavs.map((f) => (
              <CourseCard
                key={f.id}
                creatorSlug={creator.slug}
                course={{
                  slug: f.course!.slug,
                  title: f.course!.title,
                  eyebrow: f.course!.eyebrow,
                  coverUrl: f.course!.coverUrl,
                  priceCents: f.course!.priceCents,
                  currency: f.course!.currency,
                }}
              />
            ))}
          </div>
        </Section>
      ) : null}
    </div>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-end justify-between mb-5">
        <h2 className="text-h2">{title}</h2>
        <span className="text-mono-sm" style={{ color: "var(--lichen)" }}>
          {count} {count === 1 ? "item" : "items"}
        </span>
      </div>
      {children}
    </section>
  );
}
