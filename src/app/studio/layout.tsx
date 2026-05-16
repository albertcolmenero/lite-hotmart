import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCreatorForCurrentUser } from "@/lib/auth";
import { SavedFlash } from "@/components/saved-flash";
import { StudioSidebar, type NavGroup } from "@/components/studio-sidebar";

const NAV: NavGroup[] = [
  {
    label: "Overview",
    items: [{ href: "/studio", label: "Dashboard" }],
  },
  {
    label: "Library",
    items: [
      { href: "/studio/classes", label: "Classes" },
      { href: "/studio/series", label: "Series" },
      { href: "/studio/courses", label: "Courses" },
      { href: "/studio/tags", label: "Tags" },
      { href: "/studio/categories", label: "Categories" },
    ],
  },
  {
    label: "Audience",
    items: [
      { href: "/studio/subscribers", label: "Subscribers" },
      { href: "/studio/analytics", label: "Analytics" },
    ],
  },
  {
    label: "Studio",
    items: [
      { href: "/studio/plan", label: "Plan" },
      { href: "/studio/menu", label: "Menu" },
      { href: "/studio/branding", label: "Branding" },
      { href: "/studio/domain", label: "Domain" },
      { href: "/studio/settings", label: "Settings" },
    ],
  },
];

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const creator = await getCreatorForCurrentUser();
  if (!creator) redirect("/onboarding");

  return (
    <div
      className="flex flex-1 min-h-screen lg:flex-row flex-col"
      style={{ background: "var(--surface-page)" }}
    >
      <StudioSidebar
        nav={NAV}
        creator={{
          slug: creator.slug,
          displayName: creator.displayName,
          published: creator.published,
        }}
      />

      <main className="flex-1 overflow-y-auto">
        {!creator.published ? (
          <div
            className="px-6 lg:px-8 py-3 flex items-center justify-between gap-3 text-mono-sm"
            style={{
              background: "var(--ink)",
              color: "var(--paper)",
              letterSpacing: "0.12em",
            }}
          >
            <span className="truncate">YOUR PROFILE IS IN DRAFT</span>
            <Link
              href="/studio/publish"
              className="rounded-full px-3 py-1 shrink-0"
              style={{
                background: "var(--ember)",
                color: "var(--paper)",
                letterSpacing: "0.08em",
              }}
            >
              PUBLISH →
            </Link>
          </div>
        ) : null}
        <div className="p-6 lg:p-10 max-w-[1100px]">{children}</div>
        <Suspense fallback={null}>
          <SavedFlash />
        </Suspense>
      </main>
    </div>
  );
}
