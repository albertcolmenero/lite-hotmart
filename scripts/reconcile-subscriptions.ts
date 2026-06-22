/**
 * Recover local Subscriptions from Stripe for a creator's connected account —
 * a safety net for missed/failed webhooks. Pulls the connected account's live
 * subscriptions and upserts the local Subscription + Entitlement, mirroring the
 * webhook's handleSubscriptionUpsert.
 *
 * Must run with the LIVE platform key (the connected account is live):
 *   STRIPE_SECRET_KEY=sk_live_... pnpm tsx scripts/reconcile-subscriptions.ts anamamovement
 *   STRIPE_SECRET_KEY=sk_live_... pnpm tsx scripts/reconcile-subscriptions.ts anamamovement --apply
 */
import Stripe from "stripe";
import { PrismaClient, type SubscriptionStatus, type BillingInterval } from "@prisma/client";

const db = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", { apiVersion: "2026-04-22.dahlia" });
const APPLY = process.argv.includes("--apply");

const STATUS_MAP: Record<string, SubscriptionStatus> = {
  active: "active",
  trialing: "trialing",
  past_due: "past_due",
  canceled: "canceled",
  unpaid: "unpaid",
  incomplete: "incomplete",
  incomplete_expired: "canceled",
  paused: "past_due",
};

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.log("usage: reconcile-subscriptions.ts <creatorSlug> [--apply]");
    return;
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    console.log("STRIPE_SECRET_KEY is required (use the LIVE key).");
    return;
  }
  if (process.env.STRIPE_SECRET_KEY.startsWith("sk_test")) {
    console.log(
      "⚠️  You're using a TEST key. Live connected accounts (acct_… created via live\n" +
        "    OAuth) are NOT accessible with a test key — this will fail with account_invalid.\n" +
        "    Re-run with the LIVE key:\n" +
        `      STRIPE_SECRET_KEY='sk_live_…' pnpm reconcile:subscriptions ${process.argv[2] ?? "<slug>"}${APPLY ? " --apply" : ""}\n`,
    );
  }
  const creator = await db.creator.findUnique({ where: { slug } });
  if (!creator?.stripeAccountId) {
    console.log(`No connected creator for slug "${slug}".`);
    return;
  }
  console.log(`\nMode: ${APPLY ? "APPLY (writing)" : "dry run"} · account ${creator.stripeAccountId}\n`);

  const subs = await stripe.subscriptions.list(
    { status: "all", limit: 100 },
    { stripeAccount: creator.stripeAccountId },
  );
  console.log(`Stripe returned ${subs.data.length} subscription(s).\n`);

  let recorded = 0;
  for (const sub of subs.data) {
    const priceId = sub.items.data[0]?.price.id;
    if (!priceId) {
      console.log(`  ! ${sub.id}: no price`);
      continue;
    }
    const planPrice = await db.planPrice.findFirst({
      where: { stripePriceId: priceId },
      include: { plan: true },
    });
    if (!planPrice) {
      console.log(`  ! ${sub.id}: no local PlanPrice for ${priceId}`);
      continue;
    }

    // Resolve the local user: subscription metadata first, then customer email.
    let userId = (sub.metadata && sub.metadata.userId) || null;
    let email: string | null = null;
    if (!userId && typeof sub.customer === "string") {
      const cust = await stripe.customers
        .retrieve(sub.customer, undefined, { stripeAccount: creator.stripeAccountId })
        .catch(() => null);
      if (cust && !("deleted" in cust && cust.deleted)) email = (cust as Stripe.Customer).email ?? null;
      if (email) {
        const u = await db.user.findUnique({ where: { email } });
        if (u) userId = u.id;
      }
    }
    if (!userId) {
      console.log(`  ! ${sub.id}: cannot resolve user (email=${email ?? "?"})`);
      continue;
    }

    const item = sub.items.data[0];
    const periodStart = new Date(item.current_period_start * 1000);
    const periodEnd = new Date(item.current_period_end * 1000);
    const status: SubscriptionStatus = STATUS_MAP[sub.status] ?? "active";
    const interval: BillingInterval = planPrice.interval === "year" ? "year" : "month";
    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
    const isActive = status === "active" || status === "trialing";

    console.log(
      `  ${APPLY ? "→" : "·"} ${sub.id}  status=${status}  user=${userId}  ${planPrice.interval}×${planPrice.intervalCount}  ends=${periodEnd.toISOString().slice(0, 10)}`,
    );
    if (!APPLY) {
      recorded++;
      continue;
    }

    const dbSub = await db.subscription.upsert({
      where: { stripeSubscriptionId: sub.id },
      update: {
        status,
        planPriceId: planPrice.id,
        interval,
        stripePriceId: priceId,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        endedAt: sub.ended_at ? new Date(sub.ended_at * 1000) : null,
      },
      create: {
        userId,
        planId: planPrice.plan.id,
        planPriceId: planPrice.id,
        interval,
        stripeSubscriptionId: sub.id,
        stripeCustomerId: customerId,
        stripePriceId: priceId,
        status,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
      },
    });
    const entId = `sub_${dbSub.id}`;
    if (isActive) {
      await db.entitlement.upsert({
        where: { id: entId },
        update: { expiresAt: periodEnd, creatorId: planPrice.plan.creatorId },
        create: {
          id: entId,
          userId,
          source: "subscription",
          subscriptionId: dbSub.id,
          creatorId: planPrice.plan.creatorId,
          expiresAt: periodEnd,
        },
      });
    }
    recorded++;
  }

  console.log(`\n${APPLY ? "Recorded" : "Would record"} ${recorded} subscription(s).`);
  if (!APPLY) console.log("Re-run with --apply (and a LIVE key) to write.");
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error("error:", e);
    await db.$disconnect();
    process.exit(1);
  });
