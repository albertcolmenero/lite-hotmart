import Link from "next/link";
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
          Update your card, view invoices, or cancel — anytime, through Stripe.
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
              className="px-5 py-4 flex justify-between items-center gap-4 text-sm"
              style={i > 0 ? { borderTop: "1px solid var(--bone)" } : undefined}
            >
              <div className="min-w-0">
                <div style={{ color: "var(--ink)", fontWeight: 500 }}>
                  {s.plan.creator.displayName}
                </div>
                <div className="mt-0.5" style={{ color: "var(--lichen)" }}>
                  {s.status} · renews{" "}
                  <span className="tabular">{s.currentPeriodEnd.toLocaleDateString()}</span>
                </div>
              </div>
              {s.stripeCustomerId ? (
                <Link
                  href={`/api/stripe/portal?subscription=${s.id}`}
                  prefetch={false}
                  className="btn btn-secondary shrink-0"
                >
                  Manage
                </Link>
              ) : (
                <span className="text-mono-sm shrink-0" style={{ color: "var(--lichen)" }}>
                  Managed by platform
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
