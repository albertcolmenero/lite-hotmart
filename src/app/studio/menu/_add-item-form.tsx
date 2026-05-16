"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { STOREFRONT_PAGES } from "@/lib/storefront-pages";
import { createMenuItemAction } from "./actions";

type Category = { id: string; name: string };
type ItemType = "PAGE" | "CATEGORY" | "FAVOURITES";

export function AddMenuItemForm({ categories }: { categories: Category[] }) {
  const [type, setType] = useState<ItemType>("PAGE");

  return (
    <form action={createMenuItemAction} className="card p-4 space-y-3">
      <div className="grid sm:grid-cols-3 gap-3">
        <label className="block">
          <span
            className="text-xs font-medium"
            style={{ color: "var(--lichen)" }}
          >
            Label
          </span>
          <input
            name="name"
            required
            maxLength={40}
            placeholder="Practice"
            className="input mt-1"
          />
        </label>
        <label className="block">
          <span
            className="text-xs font-medium"
            style={{ color: "var(--lichen)" }}
          >
            Type
          </span>
          <select
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value as ItemType)}
            className="input mt-1"
          >
            <option value="PAGE">Page</option>
            <option value="CATEGORY">Category</option>
            <option value="FAVOURITES">Favourites</option>
          </select>
        </label>
        <label className="block">
          <span
            className="text-xs font-medium"
            style={{ color: "var(--lichen)" }}
          >
            Target
          </span>
          {type === "PAGE" ? (
            <select name="pageKey" required className="input mt-1">
              {Object.entries(STOREFRONT_PAGES).map(([key, def]) => (
                <option key={key} value={key}>
                  {def.label}
                </option>
              ))}
            </select>
          ) : type === "CATEGORY" ? (
            categories.length === 0 ? (
              <div
                className="text-sm mt-2"
                style={{ color: "var(--rust)" }}
              >
                Create a category first.
              </div>
            ) : (
              <select name="categoryId" required className="input mt-1">
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )
          ) : (
            <div
              className="text-sm mt-2"
              style={{ color: "var(--muted)" }}
            >
              Links to /favorites
            </div>
          )}
        </label>
      </div>
      <div>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={type === "CATEGORY" && categories.length === 0}
        >
          <Plus size={14} /> Add item
        </button>
      </div>
    </form>
  );
}
