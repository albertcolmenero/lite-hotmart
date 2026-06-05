/**
 * Backfill PlanPrice rows from the legacy Plan.monthlyPriceCents /
 * yearlyPriceCents columns, and link existing Subscriptions to their PlanPrice.
 *
 * Run AFTER `prisma db push` adds the PlanPrice table + Subscription.planPriceId.
 *
 *   pnpm tsx scripts/backfill-plan-prices.ts            # dry run (default)
 *   pnpm tsx scripts/backfill-plan-prices.ts --apply    # write changes
 *
 * Reads DATABASE_URL from .env via the Prisma client.
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const APPLY = process.argv.includes("--apply");

async function main() {
  console.log(`\nMode: ${APPLY ? "APPLY (writing)" : "dry run (no writes)"}\n`);

  const plans = await db.plan.findMany();
  let created = 0;
  for (const plan of plans) {
    const rows: { interval: string; intervalCount: number; cents: number; stripeId: string | null }[] = [];
    if (plan.monthlyPriceCents != null)
      rows.push({ interval: "month", intervalCount: 1, cents: plan.monthlyPriceCents, stripeId: plan.stripeMonthlyPriceId });
    if (plan.yearlyPriceCents != null)
      rows.push({ interval: "year", intervalCount: 1, cents: plan.yearlyPriceCents, stripeId: plan.stripeYearlyPriceId });

    for (const r of rows) {
      const existing = await db.planPrice.findUnique({
        where: {
          planId_interval_intervalCount: {
            planId: plan.id,
            interval: r.interval,
            intervalCount: r.intervalCount,
          },
        },
      });
      if (existing) {
        console.log(`  · plan ${plan.id} ${r.interval}×${r.intervalCount} already has a PlanPrice`);
        continue;
      }
      console.log(`  ${APPLY ? "→" : "·"} plan ${plan.id}: ${r.interval}×${r.intervalCount} ${r.cents}c (stripe ${r.stripeId ?? "none"})`);
      if (APPLY) {
        await db.planPrice.create({
          data: {
            planId: plan.id,
            interval: r.interval,
            intervalCount: r.intervalCount,
            priceCents: r.cents,
            stripePriceId: r.stripeId,
            active: true,
          },
        });
      }
      created++;
    }
  }

  // Link existing subscriptions to a PlanPrice (by Stripe price id, else interval).
  const subs = await db.subscription.findMany({
    where: { planPriceId: null },
    include: { plan: { include: { prices: true } } },
  });
  let linked = 0;
  for (const s of subs) {
    let pp = s.stripePriceId
      ? s.plan.prices.find((p) => p.stripePriceId === s.stripePriceId)
      : undefined;
    if (!pp) pp = s.plan.prices.find((p) => p.interval === s.interval && p.intervalCount === 1);
    if (!pp) {
      console.log(`  ! sub ${s.id}: no matching PlanPrice (interval=${s.interval})`);
      continue;
    }
    console.log(`  ${APPLY ? "→" : "·"} sub ${s.id} → planPrice ${pp.id}`);
    if (APPLY) await db.subscription.update({ where: { id: s.id }, data: { planPriceId: pp.id } });
    linked++;
  }

  console.log(
    `\n${APPLY ? "Created" : "Would create"} ${created} PlanPrice row(s); ` +
      `${APPLY ? "linked" : "would link"} ${linked} subscription(s).`,
  );
  if (!APPLY) console.log("Re-run with --apply to write these changes.");
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error("error:", e);
    await db.$disconnect();
    process.exit(1);
  });
