import { Plus } from "lucide-react";
import { getCreatorForCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { TagFolio } from "@/components/illustrations";
import { createTagAction, deleteTagAction } from "./actions";

export default async function TagsPage() {
  const creator = (await getCreatorForCurrentUser())!;
  const tags = await db.tag.findMany({
    where: { creatorId: creator.id },
    orderBy: { name: "asc" },
    include: { _count: { select: { classes: true, series: true, courses: true } } },
  });

  return (
    <div className="max-w-2xl space-y-7">
      <header>
        <h1 className="text-h1">Tags</h1>
        <p className="mt-1.5" style={{ color: "var(--lichen)" }}>
          Labels you can attach to classes, series, and courses.
        </p>
      </header>

      <form action={createTagAction} className="card p-4 flex gap-2 items-end">
        <label className="flex-1 block">
          <span className="text-xs font-medium" style={{ color: "var(--lichen)" }}>Name</span>
          <input
            name="name"
            required
            placeholder="Hips"
            className="input mt-1"
          />
        </label>
        <button type="submit" className="btn btn-primary">
          <Plus size={14} /> Add
        </button>
      </form>

      <div className="card overflow-hidden">
        {tags.length === 0 ? (
          <div className="p-10 text-center">
            <div className="mx-auto" style={{ maxWidth: 160 }}>
              <TagFolio />
            </div>
            <p className="mt-3 text-sm" style={{ color: "var(--lichen)" }}>
              Tags help subscribers find what fits today. Try a few above —
              <em> hips, mornings, all-levels, slow.</em>
            </p>
          </div>
        ) : (
          tags.map((t, i) => (
            <div
              key={t.id}
              className="px-5 py-3 flex items-center justify-between"
              style={i > 0 ? { borderTop: "1px solid var(--bone)" } : undefined}
            >
              <div>
                <span style={{ color: "var(--ink)", fontWeight: 500 }}>{t.name}</span>
                <span className="ml-2 text-mono-sm" style={{ color: "var(--muted)" }}>
                  {t.slug}
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-mono-sm" style={{ color: "var(--lichen)" }}>
                  {t._count.classes}c · {t._count.series}s · {t._count.courses}p
                </span>
                <form action={deleteTagAction}>
                  <input type="hidden" name="id" value={t.id} />
                  <button
                    type="submit"
                    className="text-sm hover:opacity-80"
                    style={{ color: "var(--rust)" }}
                  >
                    Delete
                  </button>
                </form>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
