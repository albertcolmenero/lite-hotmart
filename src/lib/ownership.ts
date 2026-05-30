import { db } from "@/lib/db";

type OwnedModel = "tag" | "category" | "class" | "series" | "course";

/**
 * Tenant-isolation guard against IDOR. Confirms every id in `ids` belongs to
 * `creatorId` for the given relation before it is connected/set on a record.
 * Throws if any id is foreign or missing — a missing tenant filter on a
 * relation attach is a cross-tenant data-leak bug, not a style issue.
 *
 * Safe to call with an empty list (no-op). Dedupes before counting.
 */
export async function assertOwned(
  model: OwnedModel,
  ids: string[],
  creatorId: string,
): Promise<void> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return;

  const where = { id: { in: unique }, creatorId };
  const count =
    model === "tag"
      ? await db.tag.count({ where })
      : model === "category"
        ? await db.category.count({ where })
        : model === "class"
          ? await db.class.count({ where })
          : model === "series"
            ? await db.series.count({ where })
            : await db.course.count({ where });

  if (count !== unique.length) {
    throw new Error(
      `Forbidden: one or more ${model} references do not belong to this creator`,
    );
  }
}
