import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { requireDbUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { EmptyState } from "@/components/empty-state";
import { EnvelopeOpen, GraduationWave } from "@/components/illustrations";

export default async function LibraryPage() {
  const user = await requireDbUser();

  const [subs, purchases] = await Promise.all([
    db.subscription.findMany({
      where: { userId: user.id, status: { in: ["active", "trialing"] } },
      include: { plan: { include: { creator: true } } },
    }),
    db.purchase.findMany({
      where: { userId: user.id },
      include: { course: { include: { creator: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const followingCreators = Array.from(
    new Map(subs.map((s) => [s.plan.creator.id, s.plan.creator])).values(),
  );

  return (
    <div className="space-y-12">
      <header>
        <h1 className="text-h1">My library</h1>
      </header>

      <section>
        <div className="flex items-end justify-between mb-4">
          <h2 className="text-h2">Subscriptions</h2>
          <span className="text-sm" style={{ color: "var(--lichen)" }}>
            {followingCreators.length} {followingCreators.length === 1 ? "creator" : "creators"}
          </span>
        </div>
        {followingCreators.length === 0 ? (
          <EmptyState
            illustration={<EnvelopeOpen />}
            title="No creators on your shelf yet."
            body="Find a creator you love and subscribe — their studio shows up here."
            primary={{ label: "Discover creators", href: "/" }}
          />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {followingCreators.map((c) => (
              <Link
                key={c.id}
                href={`/${c.slug}`}
                className="card card-pop hover:card-lift group p-4 transition-shadow flex items-center justify-between"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-10 h-10 rounded-md flex items-center justify-center shrink-0 text-base font-semibold"
                    style={{ background: c.accentColor, color: "#fff" }}
                  >
                    {c.displayName.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium truncate" style={{ color: "var(--ink)" }}>
                      {c.displayName}
                    </div>
                    <div className="text-mono-sm" style={{ color: "var(--lichen)" }}>
                      Member
                    </div>
                  </div>
                </div>
                <ArrowUpRight
                  size={16}
                  strokeWidth={1.75}
                  className="shrink-0 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                />
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-end justify-between mb-4">
          <h2 className="text-h2">Courses you own</h2>
          <span className="text-sm" style={{ color: "var(--lichen)" }}>
            {purchases.length} owned
          </span>
        </div>
        {purchases.length === 0 ? (
          <EmptyState
            illustration={<GraduationWave />}
            title="You haven't bought a course yet."
            body="Courses are one-time add-ons subscribers can buy. They stay yours forever."
          />
        ) : (
          <div className="card overflow-hidden">
            {purchases.map((p, i) => (
              <Link
                key={p.id}
                href={`/${p.course.creator.slug}/courses/${p.course.slug}`}
                className="block px-5 py-3.5 transition-colors hover:bg-[color:var(--surface)]"
                style={i > 0 ? { borderTop: "1px solid var(--bone)" } : undefined}
              >
                <div className="flex items-baseline justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-medium" style={{ color: "var(--ink)" }}>
                      {p.course.title}
                    </div>
                    <div className="mt-0.5 text-sm" style={{ color: "var(--lichen)" }}>
                      {p.course.creator.displayName}
                    </div>
                  </div>
                  <span className="text-mono-sm shrink-0" style={{ color: "var(--muted)" }}>
                    {p.createdAt.toLocaleDateString()}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
