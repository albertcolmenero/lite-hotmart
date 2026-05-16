import Link from "next/link";
import { Plus } from "lucide-react";
import { getCreatorForCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { EmptyState } from "@/components/empty-state";
import { StackedBooks } from "@/components/illustrations";

export default async function SeriesListPage() {
  const creator = (await getCreatorForCurrentUser())!;
  const list = await db.series.findMany({
    where: { creatorId: creator.id },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { classes: true } } },
  });

  return (
    <div className="space-y-7">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-h1">Series</h1>
          <p className="mt-1.5" style={{ color: "var(--lichen)" }}>
            An ordered group of classes. Give your library structure.
          </p>
        </div>
        <Link href="/studio/series/new" className="btn btn-primary">
          <Plus size={16} strokeWidth={2} />
          New series
        </Link>
      </header>

      {list.length === 0 ? (
        <EmptyState
          illustration={<StackedBooks />}
          title="Group your classes into a journey."
          body="A series turns a video list into a practice. Start with 3–5 classes that belong together."
          primary={{ label: "Build a series", href: "/studio/series/new" }}
          secondary={{ label: "Browse your classes", href: "/studio/classes" }}
        />
      ) : (
        <div className="card overflow-hidden">
          {list.map((s, i) => (
            <Link
              key={s.id}
              href={`/studio/series/${s.id}`}
              className="block px-5 py-4 transition-colors hover:bg-[color:var(--surface)]"
              style={i > 0 ? { borderTop: "1px solid var(--bone)" } : undefined}
            >
              <div className="flex items-baseline justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div
                    className="font-medium"
                    style={{ fontSize: "0.9375rem", color: "var(--ink)" }}
                  >
                    {s.title}
                  </div>
                  <div
                    className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm"
                    style={{ color: "var(--lichen)" }}
                  >
                    <StatusDot ok={s.published}>{s.published ? "Published" : "Draft"}</StatusDot>
                    <span style={{ color: "var(--bone)" }}>·</span>
                    <span className="tabular">{s._count.classes} classes</span>
                    <span style={{ color: "var(--bone)" }}>·</span>
                    <span>{s.visibleToPublic ? "Public" : "Members only"}</span>
                  </div>
                </div>
                <span className="text-mono-sm shrink-0" style={{ color: "var(--muted)" }}>
                  {s.updatedAt.toLocaleDateString()}
                </span>
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
