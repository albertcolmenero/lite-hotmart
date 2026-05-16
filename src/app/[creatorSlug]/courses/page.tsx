import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getOrCreateDbUser } from "@/lib/auth";
import { hasActiveSubscription } from "@/lib/entitlements";
import { CourseCard } from "@/components/cards";
import { GraduationWave } from "@/components/illustrations";

export default async function CoursesListPage({
  params,
}: {
  params: Promise<{ creatorSlug: string }>;
}) {
  const { creatorSlug } = await params;
  const creator = await db.creator.findUnique({ where: { slug: creatorSlug } });
  if (!creator) notFound();

  const viewer = await getOrCreateDbUser();
  const subscribed = viewer ? await hasActiveSubscription(viewer.id, creator.id) : false;

  const courses = await db.course.findMany({
    where: {
      creatorId: creator.id,
      published: true,
      ...(subscribed ? {} : { visibleToPublic: true }),
    },
    orderBy: { publishedAt: "desc" },
  });

  return (
    <div className="max-w-[1180px] mx-auto px-6 py-12 space-y-10">
      <header>
        <h1 className="text-h1">Courses</h1>
        <p className="mt-2" style={{ color: "var(--lichen)" }}>
          In-depth guided programs. Pay once and keep them forever.
        </p>
      </header>

      <section>
        <div className="flex items-end justify-between mb-5">
          <h2 className="text-h2">All courses</h2>
          <span className="text-mono-sm" style={{ color: "var(--lichen)" }}>
            {courses.length} total
          </span>
        </div>
        {courses.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="mx-auto" style={{ maxWidth: 180 }}>
              <GraduationWave />
            </div>
            <p className="mt-3" style={{ color: "var(--lichen)" }}>
              No courses yet — check back soon.
            </p>
          </div>
        ) : (
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
        )}
      </section>
    </div>
  );
}
