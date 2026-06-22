import { notFound } from "next/navigation";
import { Lock, Sparkles, Smartphone } from "lucide-react";
import { db } from "@/lib/db";
import { getOrCreateDbUser } from "@/lib/auth";
import { hasActiveSubscription } from "@/lib/entitlements";
import { LandingPlanCard, type LandingPlanCardProps } from "./_landing-plan-card";
import { toPlanDisplay } from "@/lib/plan-display";
import { BYPASS_PAYMENTS } from "@/lib/dev-auth";
import { ClassCard, SeriesCard, CourseCard } from "@/components/cards";
import { HomeContent } from "@/components/home-content-renderer";
import { isHomeDocEmpty, type HomeDoc } from "@/lib/home-content";

export default async function CreatorLanding({
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
  const subscribed = viewer
    ? await hasActiveSubscription(viewer.id, creator.id)
    : false;
  const isOwner = viewer?.id === creator.userId;
  const billingReady = BYPASS_PAYMENTS || creator.stripeOnboarded;

  const visibilityFilter = subscribed
    ? {}
    : { OR: [{ visibleToPublic: true }, { freeForEveryone: true }] };
  const courseVisibilityFilter = subscribed ? {} : { visibleToPublic: true };
  const standaloneFilter = isOwner ? {} : { standalone: true };

  const [classes, seriesList, courses] = await Promise.all([
    db.class.findMany({
      where: {
        creatorId: creator.id,
        published: true,
        ...visibilityFilter,
        ...standaloneFilter,
      },
      include: { categories: { select: { id: true, name: true } } },
      orderBy: { publishedAt: "desc" },
    }),
    db.series.findMany({
      where: {
        creatorId: creator.id,
        published: true,
        ...visibilityFilter,
      },
      include: {
        categories: { select: { id: true, name: true } },
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
        ...courseVisibilityFilter,
      },
      include: { categories: { select: { id: true, name: true } } },
      orderBy: { publishedAt: "desc" },
    }),
  ]);

  const planDisplay = toPlanDisplay(creator.plan);
  const paywall = {
    creatorId: creator.id,
    creatorSlug: creator.slug,
    creatorName: creator.displayName,
    creatorAccent: creator.accentColor,
    plan: planDisplay,
    signedIn: Boolean(viewer),
  };

  const joinCategoryNames = (
    cats: { id: string; name: string }[],
  ): string | undefined =>
    cats.length > 0 ? cats.map((c) => c.name).join(" · ") : undefined;

  const empty =
    classes.length === 0 && seriesList.length === 0 && courses.length === 0;

  const membershipProps: LandingPlanCardProps | null =
    !subscribed && creator.plan?.active && planDisplay && planDisplay.options.length > 0
      ? {
          creatorId: creator.id,
          creatorSlug: creator.slug,
          accentColor: creator.accentColor,
          plan: planDisplay,
          signedIn: Boolean(viewer),
          billingReady,
        }
      : null;

  const homeDoc = creator.homeContent as HomeDoc | null;
  const showHomeContent = homeDoc != null && !isHomeDocEmpty(homeDoc);

  return (
    <div>
      {/* hero — rich home content when set, else the plain bio as a fallback */}
      {showHomeContent || creator.bio ? (
        <section className="max-w-[760px] mx-auto px-6 pt-16 pb-12">
          <h1
            className="text-h1"
            style={{ color: "var(--ink)" }}
          >
            {creator.displayName}
          </h1>
          {showHomeContent ? (
            <div className="mt-4">
              <HomeContent doc={homeDoc!} />
            </div>
          ) : (
            <p
              className="mt-4 whitespace-pre-wrap"
              style={{ color: "var(--lichen)", lineHeight: 1.6, fontSize: "1.0625rem" }}
            >
              {creator.bio}
            </p>
          )}
        </section>
      ) : null}

      {/* Plan CTA — only when the visitor isn't subscribed and there's a plan */}
      {membershipProps ? (
        <section className="max-w-[1100px] mx-auto px-6 pb-12">
          <div className="grid lg:grid-cols-2 gap-8 items-start">
            <div>
              <span className="text-label">Membership</span>
              <h2 className="text-h1 mt-2">Unlock the full studio.</h2>
              <ul className="mt-8 space-y-4">
                <Bullet
                  accent={creator.accentColor}
                  icon={<Lock size={15} strokeWidth={2} />}
                  title="Instant access"
                  body="Unlock all classes and series the moment you join."
                />
                <Bullet
                  accent={creator.accentColor}
                  icon={<Sparkles size={15} strokeWidth={2} />}
                  title="Reach your goals"
                  body="Progress tracking and reward badges."
                />
                <Bullet
                  accent={creator.accentColor}
                  icon={<Smartphone size={15} strokeWidth={2} />}
                  title="Practice anywhere"
                  body="Every device, wherever you go."
                />
              </ul>
            </div>

            <LandingPlanCard {...membershipProps} />
          </div>
        </section>
      ) : null}

      {empty ? (
        <div className="max-w-xl mx-auto px-6 pb-20">
          <div
            className="card p-8 text-center"
            style={{ color: "var(--lichen)" }}
          >
            Nothing published yet.
          </div>
        </div>
      ) : (
        <div className="max-w-[1180px] mx-auto px-6 pb-20 space-y-14">
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
                    category={joinCategoryNames(c.categories)}
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
                    category={joinCategoryNames(s.categories)}
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
                    category={joinCategoryNames(c.categories)}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}

function Bullet({
  accent,
  icon,
  title,
  body,
}: {
  accent: string;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <li className="flex items-start gap-3">
      <div
        className="mt-0.5 w-8 h-8 rounded-md flex items-center justify-center shrink-0"
        style={{ background: `${accent}1A`, color: accent }}
      >
        {icon}
      </div>
      <div>
        <div className="font-medium text-sm" style={{ color: "var(--ink)" }}>
          {title}
        </div>
        <div className="text-sm mt-0.5" style={{ color: "var(--lichen)" }}>
          {body}
        </div>
      </div>
    </li>
  );
}
