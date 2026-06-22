/**
 * Read-only: dump a creator's plan/prices/subscriptions to diagnose a
 * "charged but no subscription recorded" issue.
 *
 *   pnpm tsx scripts/check-subscriptions.ts anamamovement
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const slug = process.argv[2] ?? "anamamovement";
  const creator = await db.creator.findUnique({
    where: { slug },
    include: { plan: { include: { prices: true } } },
  });
  if (!creator) {
    console.log(`No creator with slug "${slug}"`);
    return;
  }
  console.log("CREATOR", {
    id: creator.id,
    slug: creator.slug,
    stripeAccountId: creator.stripeAccountId,
    stripeOnboarded: creator.stripeOnboarded,
    customDomain: creator.customDomain,
    customDomainStatus: creator.customDomainStatus,
    currency: creator.currency,
  });

  console.log(
    "\nPLAN",
    creator.plan
      ? { id: creator.plan.id, active: creator.plan.active, stripeProductId: creator.plan.stripeProductId }
      : "(none)",
  );
  console.log("PLAN PRICES:");
  for (const p of creator.plan?.prices ?? []) {
    console.log(
      `  ${p.interval}x${p.intervalCount}  ${p.priceCents}c  active=${p.active}  stripePriceId=${p.stripePriceId ?? "(NONE)"}`,
    );
  }

  const subs = await db.subscription.findMany({
    where: { plan: { creatorId: creator.id } },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { user: { select: { email: true } } },
  });
  console.log(`\nSUBSCRIPTIONS (${subs.length}):`);
  for (const s of subs) {
    console.log(
      `  ${s.user.email}  status=${s.status}  stripeSub=${s.stripeSubscriptionId ?? "(none)"}  stripePrice=${s.stripePriceId ?? "(none)"}  planPriceId=${s.planPriceId ?? "(none)"}  created=${s.createdAt.toISOString()}`,
    );
  }

  const ents = await db.entitlement.findMany({
    where: { creatorId: creator.id, source: "subscription" },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { user: { select: { email: true } } },
  });
  console.log(`\nSUBSCRIPTION ENTITLEMENTS (${ents.length}):`);
  for (const e of ents) {
    console.log(`  ${e.user.email}  expiresAt=${e.expiresAt?.toISOString() ?? "null"}`);
  }
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error("error:", e);
    await db.$disconnect();
    process.exit(1);
  });
