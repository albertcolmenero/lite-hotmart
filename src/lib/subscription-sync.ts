/**
 * Canonical "Stripe Subscription → local Subscription + Entitlement" sync.
 *
 * Used by the Stripe webhook (customer.subscription.created/updated) and by
 * scripts/reconcile-subscriptions.ts (the missed-webhook safety net), so both
 * resolve prices and statuses the same way.
 *
 * Idempotency: keyed on the Stripe subscription id (`upsert`) and a
 * deterministic entitlement id (`sub_<localSubId>`), inside one transaction.
 * Replaying the same Stripe object produces the same rows.
 */

import type Stripe from "stripe";
import type { BillingInterval, SubscriptionStatus } from "@prisma/client";
import { db } from "./db";
import { stripe } from "./stripe";
import { log } from "./log";

/** Stripe has statuses our enum doesn't; map them instead of casting. */
export const STRIPE_STATUS_MAP: Record<Stripe.Subscription.Status, SubscriptionStatus> = {
  active: "active",
  trialing: "trialing",
  past_due: "past_due",
  canceled: "canceled",
  unpaid: "unpaid",
  incomplete: "incomplete",
  incomplete_expired: "canceled",
  paused: "past_due",
};

/**
 * Find the local PlanPrice a Stripe subscription belongs to, scoped to the
 * connected account the event came from (a creator controls their own Stripe
 * account, so nothing in the event may point at another creator's plan).
 *
 *   1. The cadence's current Stripe Price id: new subscriptions, and portal
 *      switches to another current cadence.
 *   2. The subscription we already recorded: renewals of subscribers still on
 *      a Price that was archived when the creator changed the amount.
 *   3. `planPriceId` from the metadata payments.ts sets at Checkout: first
 *      sight of a subscription whose Price was archived before we recorded it.
 */
export async function resolvePlanPriceForStripeSubscription(input: {
  stripeSubscriptionId: string;
  stripePriceId: string;
  metadataPlanPriceId?: string | null;
  accountId: string;
}) {
  const scope = { plan: { creator: { stripeAccountId: input.accountId } } };
  const include = { plan: { include: { creator: true } } } as const;

  const byCurrentPrice = await db.planPrice.findFirst({
    where: { stripePriceId: input.stripePriceId, ...scope },
    include,
  });
  if (byCurrentPrice) return byCurrentPrice;

  const existing = await db.subscription.findUnique({
    where: { stripeSubscriptionId: input.stripeSubscriptionId },
    select: { planPriceId: true },
  });
  if (existing?.planPriceId) {
    const byExisting = await db.planPrice.findFirst({
      where: { id: existing.planPriceId, ...scope },
      include,
    });
    if (byExisting) return byExisting;
  }

  if (input.metadataPlanPriceId) {
    const byMetadata = await db.planPrice.findFirst({
      where: { id: input.metadataPlanPriceId, ...scope },
      include,
    });
    if (byMetadata) return byMetadata;
  }

  return null;
}

export type SubscriptionSyncOutcome =
  | { kind: "synced" | "would_sync"; userId: string; planPriceId: string; status: SubscriptionStatus; periodEnd: Date }
  | { kind: "skipped"; reason: "no_price" | "unknown_price" | "unknown_user" };

/**
 * Upsert the local Subscription + Entitlement for a Stripe subscription on the
 * connected account `accountId`. `dryRun` resolves everything but writes nothing.
 */
export async function syncSubscriptionFromStripe(
  sub: Stripe.Subscription,
  accountId: string,
  opts: { dryRun?: boolean } = {},
): Promise<SubscriptionSyncOutcome> {
  const item = sub.items.data[0];
  const priceId = item?.price.id;
  if (!priceId) return { kind: "skipped", reason: "no_price" };

  const planPrice = await resolvePlanPriceForStripeSubscription({
    stripeSubscriptionId: sub.id,
    stripePriceId: priceId,
    metadataPlanPriceId: sub.metadata?.planPriceId ?? null,
    accountId,
  });
  if (!planPrice) {
    log("warn", "subscription event for unknown price", { priceId, subId: sub.id, accountId });
    return { kind: "skipped", reason: "unknown_price" };
  }
  const plan = planPrice.plan;
  const interval: BillingInterval = planPrice.interval === "year" ? "year" : "month";

  // Resolve our user id — first from subscription metadata (set at Checkout),
  // then fall back to the Customer email.
  let userId = (sub.metadata && sub.metadata.userId) || null;
  if (!userId && typeof sub.customer === "string") {
    const customer = await stripe.customers
      .retrieve(sub.customer, undefined, { stripeAccount: accountId })
      .catch(() => null);
    if (customer && !customer.deleted && customer.email) {
      const u = await db.user.findUnique({ where: { email: customer.email } });
      if (u) userId = u.id;
    }
  }
  if (!userId) {
    log("warn", "could not resolve user for subscription", { subId: sub.id });
    return { kind: "skipped", reason: "unknown_user" };
  }

  const status = STRIPE_STATUS_MAP[sub.status] ?? "active";
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const periodStart = new Date(item.current_period_start * 1000);
  const periodEnd = new Date(item.current_period_end * 1000);
  const isActive = status === "active" || status === "trialing";

  if (opts.dryRun) {
    return { kind: "would_sync", userId, planPriceId: planPrice.id, status, periodEnd };
  }

  await db.$transaction(async (tx) => {
    const dbSub = await tx.subscription.upsert({
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
        planId: plan.id,
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

    // Entitlement keyed deterministically by subscription.
    const entId = `sub_${dbSub.id}`;
    if (isActive) {
      await tx.entitlement.upsert({
        where: { id: entId },
        update: { expiresAt: periodEnd, creatorId: plan.creatorId },
        create: {
          id: entId,
          userId,
          source: "subscription",
          subscriptionId: dbSub.id,
          creatorId: plan.creatorId,
          expiresAt: periodEnd,
        },
      });
    } else {
      // Past-due / unpaid / canceled — let entitlement lapse at period end.
      await tx.entitlement.updateMany({
        where: { id: entId },
        data: { expiresAt: periodEnd },
      });
    }
  });

  return { kind: "synced", userId, planPriceId: planPrice.id, status, periodEnd };
}
