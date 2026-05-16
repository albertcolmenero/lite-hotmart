import type { MenuItem, Category } from "@prisma/client";
import { ArrowUp, ArrowDown } from "lucide-react";
import { getCreatorForCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { STOREFRONT_PAGES, isStorefrontPageKey } from "@/lib/storefront-pages";
import { AddMenuItemForm } from "./_add-item-form";
import { moveMenuItemAction, deleteMenuItemAction } from "./actions";

type MenuItemRow = MenuItem & { category: Category | null };

export default async function MenuPage() {
  const creator = (await getCreatorForCurrentUser())!;
  const [items, categories] = await Promise.all([
    db.menuItem.findMany({
      where: { creatorId: creator.id },
      orderBy: { position: "asc" },
      include: { category: true },
    }),
    db.category.findMany({
      where: { creatorId: creator.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="max-w-2xl space-y-7">
      <header>
        <h1 className="text-h1">Main menu</h1>
        <p className="mt-1.5" style={{ color: "var(--lichen)" }}>
          Tabs in your storefront header. Reorder with up/down arrows.
        </p>
      </header>

      <AddMenuItemForm categories={categories} />

      <div className="card overflow-hidden">
        {items.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm" style={{ color: "var(--lichen)" }}>
              No menu items yet. Your storefront falls back to default tabs
              (Practice, Courses, Favourites) until you add some.
            </p>
          </div>
        ) : (
          items.map((m, i) => (
            <div
              key={m.id}
              className="px-5 py-3 flex items-center gap-4"
              style={
                i > 0 ? { borderTop: "1px solid var(--bone)" } : undefined
              }
            >
              <span
                className="text-mono-sm w-6 shrink-0"
                style={{ color: "var(--muted)" }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="flex-1 min-w-0">
                <div style={{ color: "var(--ink)", fontWeight: 500 }}>
                  {m.name}
                </div>
                <div
                  className="text-mono-sm"
                  style={{ color: "var(--lichen)" }}
                >
                  {describeTarget(m)}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <form action={moveMenuItemAction}>
                  <input type="hidden" name="id" value={m.id} />
                  <input type="hidden" name="direction" value="up" />
                  <button
                    type="submit"
                    disabled={i === 0}
                    aria-label="Move up"
                    className="inline-flex items-center justify-center w-8 h-8 rounded-md disabled:opacity-30 hover:bg-[color:var(--stone)] transition-colors"
                    style={{ color: "var(--lichen)" }}
                  >
                    <ArrowUp size={14} />
                  </button>
                </form>
                <form action={moveMenuItemAction}>
                  <input type="hidden" name="id" value={m.id} />
                  <input type="hidden" name="direction" value="down" />
                  <button
                    type="submit"
                    disabled={i === items.length - 1}
                    aria-label="Move down"
                    className="inline-flex items-center justify-center w-8 h-8 rounded-md disabled:opacity-30 hover:bg-[color:var(--stone)] transition-colors"
                    style={{ color: "var(--lichen)" }}
                  >
                    <ArrowDown size={14} />
                  </button>
                </form>
                <form action={deleteMenuItemAction}>
                  <input type="hidden" name="id" value={m.id} />
                  <button
                    type="submit"
                    className="text-sm hover:opacity-80 px-2"
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

function describeTarget(m: MenuItemRow): string {
  if (m.type === "PAGE") {
    if (m.pageKey && isStorefrontPageKey(m.pageKey)) {
      return `Page · ${STOREFRONT_PAGES[m.pageKey].label}`;
    }
    return `Page · ${m.pageKey ?? "(unknown)"}`;
  }
  if (m.type === "CATEGORY") {
    return m.category ? `Category · ${m.category.name}` : "Category · (missing)";
  }
  return "Favourites";
}
