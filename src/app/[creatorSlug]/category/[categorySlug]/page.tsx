import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getOrCreateDbUser } from "@/lib/auth";
import { hasActiveSubscription } from "@/lib/entitlements";
import { toPlanDisplay } from "@/lib/plan-display";
import { ClassCard, SeriesCard, CourseCard } from "@/components/cards";

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ creatorSlug: string; categorySlug: string }>;
}) {
  const { creatorSlug, categorySlug } = await params;
  const creator = await db.creator.findUnique({
    where: { slug: creatorSlug },
    include: { plan: { include: { prices: true } } },
  });
  if (!creator) notFound();

  const category = await db.category.findFirst({
    where: { creatorId: creator.id, slug: categorySlug },
  });
  if (!category) notFound();

  const viewer = await getOrCreateDbUser();
  const subscribed = viewer
    ? await hasActiveSubscription(viewer.id, creator.id)
    : false;
  const isOwner = viewer?.id === creator.userId;
  const standaloneFilter = isOwner ? {} : { standalone: true };

  const paywall = {
    creatorId: creator.id,
    creatorSlug: creator.slug,
    creatorName: creator.displayName,
    creatorAccent: creator.accentColor,
    plan: toPlanDisplay(creator.plan),
    signedIn: Boolean(viewer),
  };

  const visibilityFilter = subscribed
    ? {}
    : { OR: [{ visibleToPublic: true }, { freeForEveryone: true }] };
  const courseVisibilityFilter = subscribed
    ? {}
    : { visibleToPublic: true };

  const [classes, seriesList, courses] = await Promise.all([
    db.class.findMany({
      where: {
        creatorId: creator.id,
        published: true,
        categories: { some: { id: category.id } },
        ...visibilityFilter,
        ...standaloneFilter,
      },
      orderBy: { publishedAt: "desc" },
    }),
    db.series.findMany({
      where: {
        creatorId: creator.id,
        published: true,
        categories: { some: { id: category.id } },
        ...visibilityFilter,
      },
      include: {
        _count: { select: { classes: true } },
        classes: {
          orderBy: { position: "asc" },
          take: 1,
          include: { classRef: { select: { thumbnailUrl: true, videoUrl: true } } },
        },
      },
      orderBy: { publishedAt: "desc" },
    }),
    db.course.findMany({
      where: {
        creatorId: creator.id,
        published: true,
        categories: { some: { id: category.id } },
        ...courseVisibilityFilter,
      },
      orderBy: { publishedAt: "desc" },
    }),
  ]);

  const empty =
    classes.length === 0 && seriesList.length === 0 && courses.length === 0;

  return (
    <div className="max-w-[1180px] mx-auto px-6 py-12 space-y-14">
      <header>
        <h1 className="text-h1">{category.name}</h1>
        {category.description ? (
          <p className="mt-2" style={{ color: "var(--lichen)" }}>
            {category.description}
          </p>
        ) : null}
      </header>

      {empty ? (
        <div className="card p-10 text-center">
          <p className="text-sm" style={{ color: "var(--lichen)" }}>
            Nothing here yet.
          </p>
        </div>
      ) : null}

      {classes.length > 0 ? (
        <section>
          <h2 className="text-h2 mb-5">Classes</h2>
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
        </section>
      ) : null}

      {seriesList.length > 0 ? (
        <section>
          <h2 className="text-h2 mb-5">Series</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {seriesList.map((s) => (
              <SeriesCard
                key={s.id}
                creatorSlug={creator.slug}
                series={{
                  slug: s.slug,
                  title: s.title,
                  coverUrl: s.coverUrl,
                  firstClass: s.classes[0]?.classRef ?? null,
                }}
                classCount={s._count.classes}
                locked={!subscribed && !s.freeForEveryone}
              />
            ))}
          </div>
        </section>
      ) : null}

      {courses.length > 0 ? (
        <section>
          <h2 className="text-h2 mb-5">Courses</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses.map((c) => (
              <CourseCard
                key={c.id}
                creatorSlug={creator.slug}
                course={{
                  slug: c.slug,
                  title: c.title,
                  eyebrow: c.eyebrow,
                  coverUrl: c.coverUrl,
                  priceCents: c.priceCents,
                  currency: c.currency,
                }}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
