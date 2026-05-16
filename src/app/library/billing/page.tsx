import { requireDbUser } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function BillingPage() {
  const user = await requireDbUser();
  const subs = await db.subscription.findMany({
    where: { userId: user.id },
    include: { plan: { include: { creator: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="max-w-2xl space-y-7">
      <header>
        <h1 className="text-h1">Billing</h1>
        <p className="mt-1.5" style={{ color: "var(--lichen)" }}>
          Stripe Customer Portal isn&apos;t wired up yet. Your subscriptions live here for now.
        </p>
      </header>

      <div className="card overflow-hidden">
        {subs.length === 0 ? (
          <div className="p-8 text-center text-sm" style={{ color: "var(--lichen)" }}>
            No subscriptions.
          </div>
        ) : (
          subs.map((s, i) => (
            <div
              key={s.id}
              className="px-5 py-4 flex justify-between items-baseline text-sm"
              style={i > 0 ? { borderTop: "1px solid var(--bone)" } : undefined}
            >
              <div>
                <div style={{ color: "var(--ink)", fontWeight: 500 }}>
                  {s.plan.creator.displayName}
                </div>
                <div className="mt-0.5" style={{ color: "var(--lichen)" }}>
                  {s.interval} · {s.status} · renews{" "}
                  <span className="tabular">{s.currentPeriodEnd.toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
