import { db } from "./db";
import { STOREFRONT_PAGES, type StorefrontPageKey } from "./storefront-pages";

export type ResolvedMenuItem = {
  id: string;
  label: string;
  href: string;
  matchPrefix: string;
};

export const DEFAULT_MENU_KEYS = [
  { type: "PAGE" as const, pageKey: "practice" as const, name: "Practice" },
  { type: "PAGE" as const, pageKey: "courses" as const, name: "Courses" },
  { type: "FAVOURITES" as const, name: "Favourites" },
];

export function getDefaultMenu(creatorSlug: string): ResolvedMenuItem[] {
  return [
    {
      id: "default-practice",
      label: "Practice",
      href: STOREFRONT_PAGES.practice.href(creatorSlug),
      matchPrefix: STOREFRONT_PAGES.practice.href(creatorSlug),
    },
    {
      id: "default-courses",
      label: "Courses",
      href: STOREFRONT_PAGES.courses.href(creatorSlug),
      matchPrefix: STOREFRONT_PAGES.courses.href(creatorSlug),
    },
    {
      id: "default-favourites",
      label: "Favourites",
      href: `/${creatorSlug}/favorites`,
      matchPrefix: `/${creatorSlug}/favorites`,
    },
  ];
}

/**
 * Load the publisher's configured menu items and resolve them into ready-to-render
 * {label, href, matchPrefix} tuples. Falls back to a default trio when no rows exist.
 */
export async function getResolvedMenuForCreator(
  creatorId: string,
  creatorSlug: string,
): Promise<ResolvedMenuItem[]> {
  const items = await db.menuItem.findMany({
    where: { creatorId },
    orderBy: { position: "asc" },
    include: { category: true },
  });

  const resolved: ResolvedMenuItem[] = [];
  for (const item of items) {
    if (item.type === "PAGE") {
      const key = item.pageKey as StorefrontPageKey | null;
      if (!key || !(key in STOREFRONT_PAGES)) continue;
      const href = STOREFRONT_PAGES[key].href(creatorSlug);
      resolved.push({ id: item.id, label: item.name, href, matchPrefix: href });
    } else if (item.type === "CATEGORY") {
      if (!item.category) continue;
      const href = `/${creatorSlug}/category/${item.category.slug}`;
      resolved.push({ id: item.id, label: item.name, href, matchPrefix: href });
    } else if (item.type === "FAVOURITES") {
      const href = `/${creatorSlug}/favorites`;
      resolved.push({ id: item.id, label: item.name, href, matchPrefix: href });
    }
  }

  return resolved.length > 0 ? resolved : getDefaultMenu(creatorSlug);
}

/**
 * Replaces the creator's menu with the default trio (Practice, Courses, Favourites).
 * Used during onboarding and as an idempotent seed primitive.
 */
export async function seedDefaultMenuItems(creatorId: string) {
  await db.menuItem.deleteMany({ where: { creatorId } });
  await db.menuItem.createMany({
    data: [
      {
        creatorId,
        name: "Practice",
        type: "PAGE",
        pageKey: "practice",
        position: 0,
      },
      {
        creatorId,
        name: "Courses",
        type: "PAGE",
        pageKey: "courses",
        position: 1,
      },
      {
        creatorId,
        name: "Favourites",
        type: "FAVOURITES",
        position: 2,
      },
    ],
  });
}
