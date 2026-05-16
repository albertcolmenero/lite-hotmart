import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireDbUser } from "@/lib/auth";
import { hasActiveSubscription, hasCoursePurchase } from "@/lib/entitlements";

export default async function CreatorLibraryPage({
  params,
}: {
  params: Promise<{ creatorSlug: string }>;
}) {
  const { creatorSlug } = await params;
  const user = await requireDbUser();
  const creator = await db.creator.findUnique({ where: { slug: creatorSlug } });
  if (!creator) notFound();

  const subscribed = await hasActiveSubscription(user.id, creator.id);

  const [classes, seriesList, courses] = await Promise.all([
    subscribed
      ? db.class.findMany({
          where: { creatorId: creator.id, published: true },
          orderBy: { publishedAt: "desc" },
        })
      : Promise.resolve([]),
    subscribed
      ? db.series.findMany({
          where: { creatorId: creator.id, published: true },
          orderBy: { publishedAt: "desc" },
        })
      : Promise.resolve([]),
    db.course.findMany({
      where: { creatorId: creator.id, published: true },
      orderBy: { publishedAt: "desc" },
    }),
  ]);
  const ownedCourses: typeof courses = [];
  for (const c of courses) {
    if (await hasCoursePurchase(user.id, c.id)) ownedCourses.push(c);
  }

  return (
    <div className="space-y-10">
      <Link href="/library" className="btn-quiet">← All creators</Link>

      <header className="flex items-center gap-3">
        <div
          className="w-11 h-11 rounded-md flex items-center justify-center shrink-0"
          style={{
            background: creator.accentColor,
            color: "#fff",
            fontSize: "1.125rem",
            fontWeight: 600,
          }}
        >
          {creator.displayName.charAt(0)}
        </div>
        <h1 className="text-h1">{creator.displayName}</h1>
      </header>

      {classes.length > 0 ? (
        <Section title="Classes" count={classes.length}>
          {classes.map((c, i) => (
            <RowLink
              key={c.id}
              href={`/${creator.slug}/practice/classes/${c.slug}`}
              title={c.title}
              meta={c.durationMins ? `${c.durationMins} min` : ""}
              first={i === 0}
            />
          ))}
        </Section>
      ) : null}

      {seriesList.length > 0 ? (
        <Section title="Series" count={seriesList.length}>
          {seriesList.map((s, i) => (
            <RowLink
              key={s.id}
              href={`/${creator.slug}/practice/series/${s.slug}`}
              title={s.title}
              meta=""
              first={i === 0}
            />
          ))}
        </Section>
      ) : null}

      {ownedCourses.length > 0 ? (
        <Section title="Courses you own" count={ownedCourses.length}>
          {ownedCourses.map((c, i) => (
            <RowLink
              key={c.id}
              href={`/${creator.slug}/courses/${c.slug}`}
              title={c.title}
              meta="Owned"
              first={i === 0}
            />
          ))}
        </Section>
      ) : null}

      {!subscribed && ownedCourses.length === 0 ? (
        <div className="card p-10 text-center" style={{ color: "var(--lichen)" }}>
          You aren&apos;t a subscriber and don&apos;t own any of {creator.displayName}&apos;s courses.
        </div>
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
      <div className="flex items-end justify-between mb-3">
        <h2 className="text-h2">{title}</h2>
        <span className="text-sm" style={{ color: "var(--lichen)" }}>
          {count} {count === 1 ? "item" : "items"}
        </span>
      </div>
      <div className="card overflow-hidden">{children}</div>
    </section>
  );
}

function RowLink({
  href,
  title,
  meta,
  first,
}: {
  href: string;
  title: string;
  meta: string;
  first: boolean;
}) {
  return (
    <Link
      href={href}
      className="block px-5 py-3.5 transition-colors hover:bg-[color:var(--surface)]"
      style={first ? undefined : { borderTop: "1px solid var(--bone)" }}
    >
      <div className="flex items-baseline justify-between gap-4 text-sm">
        <span style={{ color: "var(--ink)", fontWeight: 500 }}>{title}</span>
        {meta ? (
          <span className="text-mono-sm shrink-0" style={{ color: "var(--lichen)" }}>
            {meta}
          </span>
        ) : null}
      </div>
    </Link>
  );
}
