import Link from "next/link";
import { Plus } from "lucide-react";
import { getCreatorForCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { EmptyState } from "@/components/empty-state";
import { PosterFold } from "@/components/illustrations";

export default async function ClassesListPage() {
  const creator = (await getCreatorForCurrentUser())!;
  const classes = await db.class.findMany({
    where: { creatorId: creator.id },
    orderBy: { updatedAt: "desc" },
    include: {
      tags: true,
      categories: { select: { id: true, name: true } },
    },
  });

  return (
    <div className="space-y-7">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-h1">Classes</h1>
          <p className="mt-1.5" style={{ color: "var(--lichen)" }}>
            A class is one video + description. Tag it, set visibility, ship it.
          </p>
        </div>
        <Link href="/studio/classes/new" className="btn btn-primary">
          <Plus size={16} strokeWidth={2} />
          New class
        </Link>
      </header>

      {classes.length === 0 ? (
        <EmptyState
          illustration={<PosterFold />}
          title="It starts with one video."
          body="A YouTube or Vimeo link is enough. Pick a title, set visibility, ship it — the rest is editing."
          primary={{ label: "Add your first class", href: "/studio/classes/new" }}
        />
      ) : (
        <div className="card overflow-hidden">
          {classes.map((c, i) => (
            <Link
              key={c.id}
              href={`/studio/classes/${c.id}`}
              className="block px-5 py-4 transition-colors hover:bg-[color:var(--surface)]"
              style={i > 0 ? { borderTop: "1px solid var(--bone)" } : undefined}
            >
              <div className="flex items-baseline justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div
                    className="font-medium"
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
                    <span>{c.visibleToPublic ? "Public" : "Members only"}</span>
                    {c.freeForEveryone ? (
                      <>
                        <span style={{ color: "var(--bone)" }}>·</span>
                        <span style={{ color: "var(--accent)" }}>Free</span>
                      </>
                    ) : null}
                    {!c.standalone ? (
                      <>
                        <span style={{ color: "var(--bone)" }}>·</span>
                        <span style={{ color: "var(--muted)" }}>Series only</span>
                      </>
                    ) : null}
                    {c.durationMins ? (
                      <>
                        <span style={{ color: "var(--bone)" }}>·</span>
                        <span className="tabular">{c.durationMins} min</span>
                      </>
                    ) : null}
                  </div>
                  {c.categories.length > 0 || c.tags.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {c.categories.map((cat) => (
                        <span key={cat.id} className="chip chip--accent">{cat.name}</span>
                      ))}
                      {c.tags.map((t) => (
                        <span key={t.id} className="chip chip--quiet">{t.name}</span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <span className="text-mono-sm shrink-0" style={{ color: "var(--muted)" }}>
                  {c.updatedAt.toLocaleDateString()}
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
      <span
        className="inline-block w-1.5 h-1.5 rounded-full"
        style={{ background: "currentColor" }}
      />
      {children}
    </span>
  );
}
