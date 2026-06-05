import { getCreatorForCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatCents } from "@/lib/utils";
import { shortCadence } from "@/lib/plan-display";
import { EmptyState } from "@/components/empty-state";
import { EnvelopeOpen } from "@/components/illustrations";

export default async function SubscribersPage() {
  const creator = (await getCreatorForCurrentUser())!;
  const subs = await db.subscription.findMany({
    where: { plan: { creatorId: creator.id } },
    include: { user: true, plan: true, planPrice: true },
    orderBy: { createdAt: "desc" },
  });

  const active = subs.filter((s) => s.status === "active" || s.status === "trialing").length;

  return (
    <div className="space-y-7">
      <header>
        <h1 className="text-h1">Subscribers</h1>
        <div className="mt-1.5 flex gap-4 text-sm" style={{ color: "var(--lichen)" }}>
          <span>{subs.length} total</span>
          <span style={{ color: "var(--moss)" }}>● {active} active</span>
        </div>
      </header>

      {subs.length === 0 ? (
        <EmptyState
          illustration={<EnvelopeOpen />}
          title="The first subscriber changes everything."
          body="Share your storefront link with the people who already read what you make."
          primary={{ label: "Open my storefront", href: `/${creator.slug}` }}
          secondary={{ label: "Set up the plan first", href: "/studio/plan" }}
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--surface)" }}>
                <Th>Subscriber</Th>
                <Th>Plan</Th>
                <Th>Status</Th>
                <Th>Started</Th>
                <Th>Renews</Th>
              </tr>
            </thead>
            <tbody>
              {subs.map((s, i) => {
                const price =
                  s.planPrice?.priceCents ??
                  (s.interval === "year" ? s.plan.yearlyPriceCents : s.plan.monthlyPriceCents);
                const cadence = s.planPrice
                  ? shortCadence(s.planPrice.interval, s.planPrice.intervalCount)
                  : s.interval === "year"
                    ? "/yr"
                    : "/mo";
                const isActive = s.status === "active" || s.status === "trialing";
                return (
                  <tr
                    key={s.id}
                    style={{ borderTop: "1px solid var(--bone)" }}
                  >
                    <Td>
                      <div style={{ color: "var(--ink)", fontWeight: 500 }}>
                        {s.user.name ?? "—"}
                      </div>
                      <div className="text-mono-sm mt-0.5" style={{ color: "var(--lichen)" }}>
                        {s.user.email}
                      </div>
                    </Td>
                    <Td>
                      <span className="tabular" style={{ color: "var(--ink)" }}>
                        {price != null ? formatCents(price, s.plan.currency) : "—"}
                      </span>
                      <span className="ml-1.5 text-mono-sm" style={{ color: "var(--lichen)" }}>
                        {cadence}
                      </span>
                    </Td>
                    <Td>
                      <span
                        className="inline-flex items-center gap-1.5 text-sm"
                        style={{ color: isActive ? "var(--moss)" : "var(--lichen)" }}
                      >
                        <span
                          className="inline-block w-1.5 h-1.5 rounded-full"
                          style={{ background: "currentColor" }}
                        />
                        {s.status}
                      </span>
                    </Td>
                    <Td>
                      <span className="text-mono-sm" style={{ color: "var(--lichen)" }}>
                        {s.startedAt.toLocaleDateString()}
                      </span>
                    </Td>
                    <Td>
                      <span className="text-mono-sm" style={{ color: "var(--lichen)" }}>
                        {s.cancelAtPeriodEnd ? "cancels " : ""}
                        {s.currentPeriodEnd.toLocaleDateString()}
                      </span>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      className="text-left px-5 py-2.5 text-xs font-medium"
      style={{ color: "var(--lichen)" }}
    >
      {children}
    </th>
  );
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-5 py-3.5">{children}</td>;
}
