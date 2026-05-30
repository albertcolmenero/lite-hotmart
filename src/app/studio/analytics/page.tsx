import { getCreatorForCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatCents } from "@/lib/utils";
import { Sparkline, RetentionRing } from "@/components/sparkline";
import { EmptyState } from "@/components/empty-state";
import { BarsRising } from "@/components/illustrations";

export default async function AnalyticsPage() {
  const creator = (await getCreatorForCurrentUser())!;

  const [subs, purchases] = await Promise.all([
    db.subscription.findMany({
      where: { plan: { creatorId: creator.id } },
      include: { plan: true },
      orderBy: { createdAt: "asc" },
    }),
    db.purchase.findMany({
      where: { course: { creatorId: creator.id } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const days = 30;
  const series: number[] = [];
  const dayStart = (d: Date) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  };
  const today = dayStart(new Date());
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const mrr = subs.reduce((acc, s) => {
      const start = dayStart(s.startedAt);
      const end = s.endedAt ? dayStart(s.endedAt) : null;
      const active = start <= d && (end == null || end > d);
      if (!active) return acc;
      if (s.interval === "year" && s.plan.yearlyPriceCents) return acc + s.plan.yearlyPriceCents / 12;
      if (s.interval === "month" && s.plan.monthlyPriceCents) return acc + s.plan.monthlyPriceCents;
      return acc;
    }, 0);
    series.push(Math.round(mrr));
  }

  const currentMRR = series[series.length - 1] ?? 0;
  const prevMRR = series[0] ?? 0;
  const deltaPct =
    prevMRR > 0 ? ((currentMRR - prevMRR) / prevMRR) * 100 : currentMRR > 0 ? 100 : 0;

  const activeNow = subs.filter((s) => s.status === "active" || s.status === "trialing").length;
  const totalEver = subs.length;
  const churned = subs.filter((s) => s.status === "canceled" || s.status === "unpaid").length;
  const retained = totalEver > 0 ? Math.max(0, 1 - churned / totalEver) : 1;

  const courseRevenue = purchases.reduce((acc, p) => acc + p.amountCents, 0);
  const hasAnyData = subs.length > 0 || purchases.length > 0;

  if (!hasAnyData) {
    return (
      <div className="max-w-2xl space-y-7">
        <header>
          <h1 className="text-h1">Analytics</h1>
        </header>
        <EmptyState
          illustration={<BarsRising />}
          title="Charts come alive at the first sale."
          body="Once a subscriber joins or a course sells, you'll see MRR over time, retention, and your top content."
          primary={{ label: "Set up your plan", href: "/studio/plan" }}
          secondary={{ label: "Add a class", href: "/studio/classes/new" }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-h1">Analytics</h1>
        <p className="mt-1.5" style={{ color: "var(--lichen)" }}>
          The numbers behind your studio.
        </p>
      </header>

      <section className="card p-6">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-label">MRR · last 30 days</div>
            <div className="mt-1 flex items-baseline gap-3">
              <span
                className="tabular"
                style={{
                  fontSize: "2.5rem",
                  fontWeight: 600,
                  letterSpacing: "-0.03em",
                  lineHeight: 1,
                }}
              >
                {formatCents(currentMRR, creator.currency)}
              </span>
              <span
                className="inline-flex items-center gap-1 text-sm font-medium"
                style={{ color: deltaPct >= 0 ? "var(--moss)" : "var(--rust)" }}
              >
                {deltaPct >= 0 ? "▲" : "▼"} {Math.abs(deltaPct).toFixed(1)}%
              </span>
            </div>
          </div>
          <div className="text-right text-mono-sm" style={{ color: "var(--lichen)" }}>
            <div>High · <span className="tabular">{formatCents(Math.max(...series), creator.currency)}</span></div>
            <div>Low · <span className="tabular">{formatCents(Math.min(...series), creator.currency)}</span></div>
          </div>
        </div>
        <div className="mt-5">
          <Sparkline values={series} />
        </div>
        <div className="mt-2 flex justify-between text-mono-sm" style={{ color: "var(--muted)" }}>
          <span>30 days ago</span>
          <span>15 days ago</span>
          <span>Today</span>
        </div>
      </section>

      <section className="grid md:grid-cols-2 gap-4">
        <div className="card p-6">
          <div className="text-label">Retention · all time</div>
          <div className="mt-5 flex items-center gap-6">
            <div className="relative shrink-0">
              <RetentionRing retained={retained} />
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span
                  className="tabular"
                  style={{
                    fontSize: "1.625rem",
                    fontWeight: 600,
                    letterSpacing: "-0.02em",
                    lineHeight: 1,
                  }}
                >
                  {Math.round(retained * 100)}%
                </span>
                <span className="text-mono-sm mt-1" style={{ color: "var(--lichen)" }}>
                  retained
                </span>
              </div>
            </div>
            <ul className="space-y-2.5 text-sm">
              <KV label="Active" value={String(activeNow)} />
              <KV label="Ever" value={String(totalEver)} />
              <KV label="Churned" value={String(churned)} />
            </ul>
          </div>
        </div>

        <div className="card p-6">
          <div className="text-label">Course revenue · all time</div>
          <div
            className="mt-3 tabular"
            style={{
              fontSize: "2.5rem",
              fontWeight: 600,
              letterSpacing: "-0.03em",
              lineHeight: 1,
            }}
          >
            {formatCents(courseRevenue, creator.currency)}
          </div>
          <div className="mt-1.5 text-sm" style={{ color: "var(--lichen)" }}>
            {purchases.length} {purchases.length === 1 ? "purchase" : "purchases"}
          </div>

          <div className="mt-5 pt-4" style={{ borderTop: "1px solid var(--bone)" }}>
            <div className="text-label">Recent</div>
            <ul className="mt-2 space-y-1.5 text-sm">
              {purchases.slice(-3).reverse().map((p) => (
                <li key={p.id} className="flex justify-between">
                  <span className="tabular" style={{ color: "var(--ink)" }}>
                    {formatCents(p.amountCents, p.currency)}
                  </span>
                  <span className="text-mono-sm" style={{ color: "var(--lichen)" }}>
                    {p.createdAt.toLocaleDateString()}
                  </span>
                </li>
              ))}
              {purchases.length === 0 ? (
                <li style={{ color: "var(--lichen)" }}>No purchases yet.</li>
              ) : null}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-baseline gap-3">
      <span className="w-16 text-sm" style={{ color: "var(--lichen)" }}>{label}</span>
      <span
        className="tabular"
        style={{ fontSize: "1.125rem", fontWeight: 600, color: "var(--ink)" }}
      >
        {value}
      </span>
    </li>
  );
}
