import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getActiveCreator, getOrCreateDbUser } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/super-admin";
import { db } from "@/lib/db";
import { SavedFlash } from "@/components/saved-flash";
import {
  StudioSidebar,
  type NavGroup,
  type SuperAdminProps,
} from "@/components/studio-sidebar";

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

export default async function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getOrCreateDbUser();
  if (!user) redirect("/sign-in");

  const creator = await getActiveCreator();
  const superAdmin = isSuperAdmin(user);

  if (!creator) {
    // Super admins without an active selection get a studio chooser.
    // (The chooser lives outside this layout to avoid a redirect loop.)
    // Regular users without a creator still go through onboarding.
    if (superAdmin) redirect("/studio-select");
    redirect("/onboarding");
  }

  // Build super-admin context for the sidebar switcher (only when applicable).
  let superAdminProps: SuperAdminProps | undefined;
  if (superAdmin) {
    const [creators, ownCreator] = await Promise.all([
      db.creator.findMany({
        orderBy: { displayName: "asc" },
        select: { id: true, slug: true, displayName: true },
      }),
      db.creator.findUnique({
        where: { userId: user.id },
        select: { id: true },
      }),
    ]);
    superAdminProps = {
      active: {
        id: creator.id,
        slug: creator.slug,
        displayName: creator.displayName,
      },
      creators,
      ownCreatorId: ownCreator?.id ?? null,
    };
  }

  const isImpersonating = superAdmin && creator.userId !== user.id;

  return (
    <div
      className="flex lg:flex-row flex-col"
      style={{
        // Pin the studio shell to the viewport so the sidebar is always
        // exactly window-tall and only <main> scrolls. `top` accounts for
        // any chrome the root layout paints above us (e.g. the
        // DEV_AUTH_BYPASS banner).
        position: "fixed",
        top: "var(--app-chrome-h, 0px)",
        left: 0,
        right: 0,
        bottom: 0,
        background: "var(--surface-page)",
      }}
    >
      <StudioSidebar
        nav={NAV}
        creator={{
          slug: creator.slug,
          displayName: creator.displayName,
          published: creator.published,
        }}
        superAdmin={superAdminProps}
      />

      <main className="flex-1 min-h-0 overflow-y-auto">
        {isImpersonating ? (
          <div
            className="px-6 lg:px-8 py-2.5 text-sm"
            style={{
              background: "var(--amber)",
              color: "var(--paper)",
            }}
          >
            <span className="truncate">
              Viewing as <strong>{creator.displayName}</strong> · @{creator.slug} —
              changes affect this creator&apos;s storefront. Use the switcher
              top-left to exit.
            </span>
          </div>
        ) : null}

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
