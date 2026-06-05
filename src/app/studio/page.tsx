import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getCreatorForCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatCents } from "@/lib/utils";
import { cadenceMonths } from "@/lib/billing-cadences";
import { toPlanDisplay } from "@/lib/plan-display";

export default async function StudioOverviewPage() {
  const creator = (await getCreatorForCurrentUser())!;

  const [classCount, seriesCount, courseCount, plan, activeSubs, recentSubs, recentPurchases] = await Promise.all([
    db.class.count({ where: { creatorId: creator.id, published: true } }),
    db.series.count({ where: { creatorId: creator.id, published: true } }),
    db.course.count({ where: { creatorId: creator.id, published: true } }),
    db.plan.findUnique({ where: { creatorId: creator.id }, include: { prices: true } }),
    db.subscription.findMany({
      where: { plan: { creatorId: creator.id }, status: { in: ["active", "trialing"] } },
      include: { plan: true, planPrice: true },
    }),
    db.subscription.findMany({
      where: { plan: { creatorId: creator.id } },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { user: true },
    }),
    db.purchase.findMany({
      where: { course: { creatorId: creator.id } },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { course: true, user: true },
    }),
  ]);

  const mrrCents = activeSubs.reduce((acc, s) => {
    const pp = s.planPrice;
    if (pp) return acc + pp.priceCents / cadenceMonths(pp.interval, pp.intervalCount);
    if (s.interval === "year" && s.plan.yearlyPriceCents) return acc + s.plan.yearlyPriceCents / 12;
    if (s.interval === "month" && s.plan.monthlyPriceCents) return acc + s.plan.monthlyPriceCents;
    return acc;
  }, 0);

  const planDisplay = toPlanDisplay(plan);
  const cheapest = planDisplay?.options[0];

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-h1">Dashboard</h1>
        <p className="mt-1.5" style={{ color: "var(--lichen)" }}>
          Welcome back, {creator.displayName.split(" ")[0]}.
        </p>
      </header>

      <div
        className="grid grid-cols-2 md:grid-cols-4 gap-px overflow-hidden card"
        style={{ background: "var(--bone)" }}
      >
        <Stat label="MRR" value={formatCents(Math.round(mrrCents), creator.currency)} hint="monthly recurring" />
        <Stat label="Subscribers" value={String(activeSubs.length)} hint="active now" />
        <Stat
          label="Library"
          value={String(classCount + seriesCount + courseCount)}
          hint={`${classCount} classes · ${seriesCount} series · ${courseCount} courses`}
        />
        <Stat
          label="Plan"
          value={
            plan?.active && cheapest && planDisplay
              ? formatCents(cheapest.priceCents, planDisplay.currency)
              : "—"
          }
          hint={
            planDisplay && planDisplay.options.length > 1
              ? `${planDisplay.options.length} cadences`
              : cheapest?.note ?? "monthly"
          }
        />
      </div>

      <section>
        <div className="flex items-end justify-between mb-4">
          <h2 className="text-h2">Recent activity</h2>
          <Link href="/studio/subscribers" className="btn-quiet">See subscribers →</Link>
        </div>

        <div className="card overflow-hidden">
          {recentSubs.length === 0 && recentPurchases.length === 0 ? (
            <div className="p-10 text-center text-sm" style={{ color: "var(--lichen)" }}>
              No activity yet. Add a class and share your link to get the first sale.
            </div>
          ) : (
            <ul>
              {recentSubs.map((s, i) => (
                <ActivityRow
                  key={s.id}
                  first={i === 0}
                  left={
                    <>
                      <strong style={{ color: "var(--ink)" }}>
                        {s.user.name ?? s.user.email}
                      </strong>{" "}
                      <span style={{ color: "var(--lichen)" }}>subscribed · {s.interval}</span>
                    </>
                  }
                  right={s.createdAt.toLocaleDateString()}
                />
              ))}
              {recentPurchases.map((p) => (
                <ActivityRow
                  key={p.id}
                  first={false}
                  left={
                    <>
                      <strong style={{ color: "var(--ink)" }}>
                        {p.user.name ?? p.user.email}
                      </strong>{" "}
                      <span style={{ color: "var(--lichen)" }}>bought</span>{" "}
                      <span style={{ color: "var(--ink)" }}>{p.course.title}</span>
                    </>
                  }
                  right={`${formatCents(p.amountCents, p.currency)} · ${p.createdAt.toLocaleDateString()}`}
                />
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <QuickAction href="/studio/classes/new" title="Add a class" body="A single video with description and tags." />
        <QuickAction href="/studio/series/new" title="Build a series" body="Group classes into a guided practice." />
        <QuickAction href="/studio/courses/new" title="Launch a course" body="An in-depth program sold once." />
      </section>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="p-5" style={{ background: "var(--paper)" }}>
      <div className="text-label">{label}</div>
      <div
        className="mt-2 tabular"
        style={{
          fontSize: "1.875rem",
          fontWeight: 600,
          letterSpacing: "-0.025em",
          lineHeight: 1,
          color: "var(--ink)",
        }}
      >
        {value}
      </div>
      <div className="mt-1.5 text-sm" style={{ color: "var(--lichen)" }}>{hint}</div>
    </div>
  );
}

function ActivityRow({ left, right, first }: { left: React.ReactNode; right: string; first: boolean }) {
  return (
    <li
      className="px-5 py-3 flex items-baseline justify-between text-sm"
      style={first ? undefined : { borderTop: "1px solid var(--bone)" }}
    >
      <span>{left}</span>
      <span className="text-mono-sm shrink-0" style={{ color: "var(--lichen)" }}>{right}</span>
    </li>
  );
}

function QuickAction({ href, title, body }: { href: string; title: string; body: string }) {
  return (
    <Link
      href={href}
      className="card card-pop hover:card-lift group p-5 transition-shadow block"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-h3">{title}</div>
          <p className="mt-1.5 text-sm" style={{ color: "var(--lichen)" }}>{body}</p>
        </div>
        <ArrowUpRight
          size={18}
          strokeWidth={1.75}
          className="shrink-0 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
          style={{ color: "var(--ink)" }}
        />
      </div>
    </Link>
  );
}
