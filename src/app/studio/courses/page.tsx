import Link from "next/link";
import { Plus } from "lucide-react";
import { getCreatorForCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatCents } from "@/lib/utils";
import { EmptyState } from "@/components/empty-state";
import { GraduationWave } from "@/components/illustrations";

export default async function CoursesListPage() {
  const creator = (await getCreatorForCurrentUser())!;
  const list = await db.course.findMany({
    where: { creatorId: creator.id },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { classes: true } } },
  });

  return (
    <div className="space-y-7">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-h1">Courses</h1>
          <p className="mt-1.5" style={{ color: "var(--lichen)" }}>
            One-time purchase add-ons for subscribers. The premium tier of your library.
          </p>
        </div>
        <Link href="/studio/courses/new" className="btn btn-primary">
          <Plus size={16} strokeWidth={2} />
          New course
        </Link>
      </header>

      {list.length === 0 ? (
        <EmptyState
          illustration={<GraduationWave />}
          title="One course can pay for the year."
          body="Courses are bigger than a series — a single price, a finished arc. Subscribers buy them on top of their membership."
          primary={{ label: "Launch a course", href: "/studio/courses/new" }}
        />
      ) : (
        <div className="card overflow-hidden">
          {list.map((c, i) => (
            <Link
              key={c.id}
              href={`/studio/courses/${c.id}`}
              className="block px-5 py-4 transition-colors hover:bg-[color:var(--surface)]"
              style={i > 0 ? { borderTop: "1px solid var(--bone)" } : undefined}
            >
              <div className="flex items-baseline justify-between gap-4">
                <div className="min-w-0 flex-1">
                  {c.eyebrow ? (
                    <div
                      className="text-xs font-semibold tracking-wide"
                      style={{ color: "var(--accent)", letterSpacing: "0.06em" }}
                    >
                      {c.eyebrow}
                    </div>
                  ) : null}
                  <div
                    className="font-medium mt-0.5"
                    style={{ fontSize: "0.9375rem", color: "var(--ink)" }}
                  >
                    {c.title}
                  </div>
                  <div
                    className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm"
                    style={{ color: "var(--lichen)" }}
                  >
                    <StatusDot ok={c.published}>{c.published ? "Published" : "Draft"}</StatusDot>
                    <span style={{ color: "var(--bone)" }}>·</span>
                    <span className="tabular">{c._count.classes} classes</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div
                    className="tabular"
                    style={{
                      fontSize: "1.125rem",
                      fontWeight: 600,
                      letterSpacing: "-0.015em",
                      color: "var(--ink)",
                    }}
                  >
                    {formatCents(c.priceCents, c.currency)}
                  </div>
                  <div className="text-mono-sm mt-0.5" style={{ color: "var(--muted)" }}>
                    {c.updatedAt.toLocaleDateString()}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusDot({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1.5"
      style={{ color: ok ? "var(--moss)" : "var(--lichen)" }}
    >
      <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: "currentColor" }} />
      {children}
    </span>
  );
}
