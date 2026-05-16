export const STOREFRONT_PAGES = {
  practice: {
    label: "Practice",
    href: (slug: string) => `/${slug}/practice`,
  },
  courses: {
    label: "Courses",
    href: (slug: string) => `/${slug}/courses`,
  },
} as const;

export type StorefrontPageKey = keyof typeof STOREFRONT_PAGES;

export const STOREFRONT_PAGE_KEYS = Object.keys(
  STOREFRONT_PAGES,
) as StorefrontPageKey[];

export function isStorefrontPageKey(v: unknown): v is StorefrontPageKey {
  return typeof v === "string" && v in STOREFRONT_PAGES;
}
