import { redirect } from "next/navigation";
import { getOrCreateDbUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isSuperAdmin } from "@/lib/super-admin";
import { switchToCreatorAction } from "@/app/studio/_actions/switch-creator";

/**
 * Studio chooser for super admins who don't have their own creator profile.
 * Lists every creator on the platform; clicking one sets the active-creator
 * cookie and bounces back into `/studio`.
 *
 * Regular users never reach this page — they're sent to /onboarding by the
 * studio layout instead.
 */
export default async function StudioSelectPage() {
  const user = await getOrCreateDbUser();
  if (!user) redirect("/sign-in");
  if (!isSuperAdmin(user)) redirect("/studio");

  const creators = await db.creator.findMany({
    orderBy: { displayName: "asc" },
    select: { id: true, slug: true, displayName: true },
  });

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--surface-page)" }}
    >
      <header
        className="h-14 flex items-center px-5"
        style={{
          background: "var(--paper)",
          borderBottom: "1px solid var(--bone)",
        }}
      >
        <div className="flex items-center gap-2">
          <span
            className="inline-block w-5 h-5 rounded-md"
            style={{ background: "var(--ink)" }}
          />
          <span className="font-medium tracking-tight">Lite Creator</span>
        </div>
        <span
          className="ml-3 text-xs px-2 py-0.5 rounded-full"
          style={{
            background: "var(--stone)",
            color: "var(--lichen)",
          }}
        >
          Super admin
        </span>
      </header>

      <main className="flex-1 max-w-xl mx-auto w-full px-6 py-16">
        <h1 className="text-h1">Pick a studio to manage</h1>
        <p className="mt-2" style={{ color: "var(--lichen)" }}>
          You don&apos;t have a creator profile of your own. Choose one of the
          publishers below to step into their studio.
        </p>

        {creators.length === 0 ? (
          <div
            className="card p-8 mt-8 text-center text-sm"
            style={{ color: "var(--lichen)" }}
          >
            No creators have signed up yet.
          </div>
        ) : (
          <div className="card overflow-hidden mt-8">
            {creators.map((c, i) => (
              <form key={c.id} action={switchToCreatorAction}>
                <input type="hidden" name="creatorId" value={c.id} />
                <button
                  type="submit"
                  className="w-full text-left px-5 py-4 flex items-center justify-between gap-4 transition-colors hover:bg-[color:var(--surface)]"
                  style={
                    i > 0 ? { borderTop: "1px solid var(--bone)" } : undefined
                  }
                >
                  <div className="min-w-0">
                    <div
                      className="font-medium"
                      style={{ color: "var(--ink)" }}
                    >
                      {c.displayName}
                    </div>
                    <div
                      className="text-mono-sm mt-0.5"
                      style={{ color: "var(--muted)" }}
                    >
                      @{c.slug}
                    </div>
                  </div>
                  <span
                    className="text-sm shrink-0"
                    style={{ color: "var(--accent)" }}
                  >
                    Open →
                  </span>
                </button>
              </form>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
