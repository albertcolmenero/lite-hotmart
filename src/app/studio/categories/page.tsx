import Link from "next/link";
import { Plus } from "lucide-react";
import { getCreatorForCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { createCategoryAction, deleteCategoryAction } from "./actions";

export default async function CategoriesPage() {
  const creator = (await getCreatorForCurrentUser())!;
  const categories = await db.category.findMany({
    where: { creatorId: creator.id },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { classes: true, series: true, courses: true } },
    },
  });

  return (
    <div className="max-w-2xl space-y-7">
      <header>
        <h1 className="text-h1">Categories</h1>
        <p className="mt-1.5" style={{ color: "var(--lichen)" }}>
          Group classes, series, and courses into themed buckets. Use them as
          tabs in your main menu.
        </p>
      </header>

      <form
        action={createCategoryAction}
        className="card p-4 flex gap-2 items-end"
      >
        <label className="flex-1 block">
          <span
            className="text-xs font-medium"
            style={{ color: "var(--lichen)" }}
          >
            Name
          </span>
          <input
            name="name"
            required
            placeholder="Flexibility"
            className="input mt-1"
          />
        </label>
        <button type="submit" className="btn btn-primary">
          <Plus size={14} /> Add
        </button>
      </form>

      <div className="card overflow-hidden">
        {categories.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm" style={{ color: "var(--lichen)" }}>
              No categories yet. Create one above — e.g.{" "}
              <em>flexibility, strength, mornings</em> — then assign items to
              it.
            </p>
          </div>
        ) : (
          categories.map((c, i) => (
            <div
              key={c.id}
              className="px-5 py-3 flex items-center justify-between"
              style={
                i > 0 ? { borderTop: "1px solid var(--bone)" } : undefined
              }
            >
              <Link
                href={`/studio/categories/${c.id}`}
                className="flex-1 min-w-0"
              >
                <span style={{ color: "var(--ink)", fontWeight: 500 }}>
                  {c.name}
                </span>
                <span
                  className="ml-2 text-mono-sm"
                  style={{ color: "var(--muted)" }}
                >
                  {c.slug}
                </span>
              </Link>
              <div className="flex items-center gap-4 text-sm">
                <span
                  className="text-mono-sm"
                  style={{ color: "var(--lichen)" }}
                >
                  {c._count.classes}c · {c._count.series}s ·{" "}
                  {c._count.courses}p
                </span>
                <form action={deleteCategoryAction}>
                  <input type="hidden" name="id" value={c.id} />
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
