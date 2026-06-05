import { notFound } from "next/navigation";
import Link from "next/link";
import { GraduationCap, Play, Check } from "lucide-react";
import { db } from "@/lib/db";
import { getOrCreateDbUser } from "@/lib/auth";
import {
  canPlayCourse,
  hasActiveSubscription,
  hasCoursePurchase,
} from "@/lib/entitlements";
import { youtubeThumbnail } from "@/components/video-embed";
import { toPlanDisplay } from "@/lib/plan-display";
import { formatCents } from "@/lib/utils";
import { BuyCourseButton } from "./_buy-course-button";

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ creatorSlug: string; courseSlug: string }>;
}) {
  const { creatorSlug, courseSlug } = await params;
  const creator = await db.creator.findUnique({
    where: { slug: creatorSlug },
    include: { plan: { include: { prices: true } } },
  });
  if (!creator) notFound();

  const course = await db.course.findUnique({
    where: { creatorId_slug: { creatorId: creator.id, slug: courseSlug } },
    include: { classes: { orderBy: { position: "asc" }, include: { classRef: true } } },
  });
  if (!course || !course.published) notFound();

  const viewer = await getOrCreateDbUser();
  const isOwner = viewer?.id === creator.userId;
  if (!course.visibleToPublic && !isOwner) {
    if (!viewer) notFound();
    const owned = await hasCoursePurchase(viewer.id, course.id);
    if (!owned) notFound();
  }

  const access = await canPlayCourse({ userId: viewer?.id ?? null, courseId: course.id });
  const subscribed = viewer ? await hasActiveSubscription(viewer.id, creator.id) : false;

  type GroupRow = (typeof course.classes)[number];
  type Group = { label: string | null; items: GroupRow[] };
  const grouped: Group[] = [];
  for (const cc of course.classes) {
    const last: Group | undefined = grouped[grouped.length - 1];
    if (!last || (cc.moduleLabel && cc.moduleLabel !== last.label)) {
      const carriedLabel = cc.moduleLabel ?? last?.label ?? null;
      grouped.push({ label: carriedLabel, items: [cc] });
    } else {
      last.items.push(cc);
    }
  }

  return (
    <div className="max-w-[1180px] mx-auto px-6 py-10 grid lg:grid-cols-[1.1fr_1fr] gap-10">
      {/* LEFT */}
      <div className="space-y-5">
        <div className="flex items-center gap-2 text-mono-sm" style={{ color: "var(--muted)" }}>
          <GraduationCap size={14} strokeWidth={1.75} />
          Course
        </div>

        {course.eyebrow ? (
          <div
            className="text-xs font-semibold tracking-wide"
            style={{ color: "var(--accent)", letterSpacing: "0.08em" }}
          >
            {course.eyebrow}
          </div>
        ) : null}

        <h1 className="text-h1" style={{ color: "var(--ink)" }}>
          {course.title}
        </h1>

        {course.description ? (
          <p
            className="whitespace-pre-wrap"
            style={{
              fontSize: "1rem",
              lineHeight: 1.65,
              color: "var(--ink)",
            }}
          >
            {course.description}
          </p>
        ) : null}

        {course.coverUrl ? (
          <div
            className="overflow-hidden card"
            style={{ aspectRatio: "16 / 10", background: "var(--stone)" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={course.coverUrl} alt="" className="w-full h-full object-cover" />
          </div>
        ) : null}

        {access.allowed ? (
          <div
            className="flex items-center gap-2.5 p-4"
            style={{
              background: "color-mix(in srgb, var(--moss) 8%, var(--paper))",
              border: "1px solid color-mix(in srgb, var(--moss) 25%, var(--bone))",
              borderRadius: "var(--radius-md)",
            }}
          >
            <Check size={16} strokeWidth={2.5} style={{ color: "var(--moss)" }} />
            <span className="text-sm" style={{ color: "var(--ink)" }}>
              You own this course. Pick any class to begin.
            </span>
          </div>
        ) : (
          <BuyCourseButton
            courseId={course.id}
            priceCents={course.priceCents}
            currency={course.currency}
            subscribed={subscribed}
            signedIn={Boolean(viewer)}
            creator={{
              id: creator.id,
              displayName: creator.displayName,
              accentColor: creator.accentColor,
            }}
            plan={toPlanDisplay(creator.plan)}
          />
        )}
      </div>

      {/* RIGHT */}
      <div>
        <div className="flex items-end justify-between mb-3">
          <h2 className="text-h3">Course content</h2>
          <span className="text-mono-sm" style={{ color: "var(--lichen)" }}>
            {course.classes.length} classes
          </span>
        </div>

        <div className="card overflow-hidden">
          {grouped.map((g, gi) => (
            <div key={gi}>
              {g.label ? (
                <div
                  className="px-4 py-2 text-mono-sm"
                  style={{
                    background: "var(--surface)",
                    color: "var(--lichen)",
                    borderBottom: "1px solid var(--bone)",
                    borderTop: gi > 0 ? "1px solid var(--bone)" : "none",
                  }}
                >
                  {g.label}
                </div>
              ) : null}
              {g.items.map((cc, ci) => {
                const c = cc.classRef;
                const thumb = c.thumbnailUrl || youtubeThumbnail(c.videoUrl);
                const showBorder = !(ci === 0 && g.label);
                const Inner = (
                  <div
                    className="flex items-center gap-3 px-4 py-3"
                    style={
                      showBorder ? { borderTop: "1px solid var(--bone)" } : undefined
                    }
                  >
                    <div
                      className="relative w-16 h-12 overflow-hidden shrink-0"
                      style={{ background: "var(--stone)", borderRadius: "var(--radius-sm)" }}
                    >
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumb} alt="" className="w-full h-full object-cover" />
                      ) : null}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Play
                          size={12}
                          strokeWidth={2}
                          fill="currentColor"
                          className="text-white"
                          style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.5))" }}
                        />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div
                        className="font-medium truncate text-sm"
                        style={{ color: "var(--ink)" }}
                      >
                        {c.title}
                      </div>
                      {c.durationMins ? (
                        <div className="mt-0.5 text-mono-sm" style={{ color: "var(--lichen)" }}>
                          {c.durationMins} min
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
                return access.allowed ? (
                  <Link
                    key={c.id}
                    href={`/${creator.slug}/practice/classes/${c.slug}`}
                    className="block transition-colors hover:bg-[color:var(--surface)]"
                  >
                    {Inner}
                  </Link>
                ) : (
                  <div key={c.id} style={{ opacity: 0.55 }}>
                    {Inner}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {!access.allowed ? (
          <div className="mt-4 text-sm text-center" style={{ color: "var(--lichen)" }}>
            Price · {formatCents(course.priceCents, course.currency)}
          </div>
        ) : null}
      </div>
    </div>
  );
}
