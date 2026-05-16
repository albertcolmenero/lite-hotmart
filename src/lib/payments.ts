"use server";

import { db } from "./db";
import { requireDbUser } from "./auth";
import { BYPASS_PAYMENTS } from "./dev-auth";
import { stripe, PLATFORM_FEE_BPS } from "./stripe";
import { syncPlanToStripe, syncCourseToStripe, creatorIsLive } from "./stripe-sync";
import type { BillingInterval } from "@prisma/client";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export type SubscribeResult = {
  subscriptionId?: string;
  redirectUrl?: string;
};

export type PurchaseResult = {
  purchaseId?: string;
  redirectUrl?: string;
};

/**
 * Subscribe action. Two paths:
 *   - Creator stripeOnboarded → return Stripe Checkout URL; client redirects.
 *   - Otherwise (bypass) → create local Subscription + Entitlement directly.
 *
 * BYPASS_PAYMENTS=1 forces the bypass path regardless of creator state — useful
 * for tests and for the dev seed creator who can't realistically run KYC.
 */
export async function subscribeToCreatorAction(input: {
  creatorId: string;
  interval: BillingInterval;
}): Promise<SubscribeResult> {
  const user = await requireDbUser();
  const plan = await db.plan.findUnique({
    where: { creatorId: input.creatorId },
    include: { creator: true },
  });
  if (!plan || !plan.active) throw new Error("This creator has no active plan.");
  if (input.interval === "month" && !plan.monthlyPriceCents) {
    throw new Error("Monthly plan unavailable.");
  }
  if (input.interval === "year" && !plan.yearlyPriceCents) {
    throw new Error("Yearly plan unavailable.");
  }

  const useStripe = !BYPASS_PAYMENTS && creatorIsLive(plan.creator);

  // ────────────────────────────── Bypass path
  if (!useStripe) {
    // Cancel any prior active subscription for this creator
    await db.subscription.updateMany({
      where: {
        userId: user.id,
        plan: { creatorId: input.creatorId },
        status: { in: ["active", "trialing"] },
      },
      data: { status: "canceled", endedAt: new Date(), cancelAtPeriodEnd: false },
    });

    const now = new Date();
    const periodEnd = new Date(now);
    if (input.interval === "month") periodEnd.setMonth(periodEnd.getMonth() + 1);
    else periodEnd.setFullYear(periodEnd.getFullYear() + 1);

    const sub = await db.subscription.create({
      data: {
        userId: user.id,
        planId: plan.id,
        interval: input.interval,
        status: "active",
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
    });

    await db.entitlement.create({
      data: {
        userId: user.id,
        source: "subscription",
        creatorId: input.creatorId,
        subscriptionId: sub.id,
        expiresAt: periodEnd,
      },
    });

    return { subscriptionId: sub.id };
  }

  // ────────────────────────────── Stripe Checkout path
  // Make sure Plan has up-to-date Stripe Prices on the connected account.
  const syncResult = await syncPlanToStripe(plan.creator, plan);
  const priceId =
    input.interval === "month"
      ? syncResult?.monthlyPriceId ?? plan.stripeMonthlyPriceId
      : syncResult?.yearlyPriceId ?? plan.stripeYearlyPriceId;
  if (!priceId) throw new Error("Stripe price not configured for this interval.");

  const session = await stripe.checkout.sessions.create(
    {
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: user.email,
      subscription_data: {
        application_fee_percent: PLATFORM_FEE_BPS / 100,
        trial_period_days: plan.trialDays > 0 ? plan.trialDays : undefined,
        metadata: {
          userId: user.id,
          creatorId: plan.creatorId,
          planId: plan.id,
          interval: input.interval,
        },
      },
      metadata: {
        kind: "subscription",
        userId: user.id,
        creatorId: plan.creatorId,
        planId: plan.id,
        interval: input.interval,
      },
      success_url: `${APP_URL}/library/${plan.creator.slug}?subscribed=1`,
      cancel_url: `${APP_URL}/${plan.creator.slug}`,
    },
    { stripeAccount: plan.creator.stripeAccountId! },
  );

  if (!session.url) throw new Error("Stripe did not return a Checkout URL.");
  return { redirectUrl: session.url };
}

/**
 * One-time course purchase. Per product spec, only active subscribers can buy.
 */
export async function purchaseCourseAction(courseId: string): Promise<PurchaseResult> {
  const user = await requireDbUser();
  const course = await db.course.findUnique({
    where: { id: courseId },
    include: { creator: true },
  });
  if (!course || !course.published) throw new Error("Course not available.");

  // Subscription gate
  const sub = await db.entitlement.findFirst({
    where: {
      userId: user.id,
      source: "subscription",
      creatorId: course.creatorId,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
  });
  if (!sub) throw new Error("Subscribe first to buy courses.");

  // Idempotent: existing purchase short-circuits.
  const existing = await db.purchase.findUnique({
    where: { userId_courseId: { userId: user.id, courseId } },
  });
  if (existing) return { purchaseId: existing.id };

  const useStripe = !BYPASS_PAYMENTS && creatorIsLive(course.creator);

  // ────────────────────────────── Bypass path
  if (!useStripe) {
    const purchase = await db.purchase.create({
      data: {
        userId: user.id,
        courseId,
        amountCents: course.priceCents,
        currency: course.currency,
      },
    });
    await db.entitlement.create({
      data: {
        userId: user.id,
        source: "purchase",
        courseId,
        purchaseId: purchase.id,
      },
    });
    return { purchaseId: purchase.id };
  }

  // ────────────────────────────── Stripe Checkout path
  const syncResult = await syncCourseToStripe(course.creator, course);
  const priceId = syncResult?.priceId ?? course.stripePriceId;
  if (!priceId) throw new Error("Stripe price not configured for this course.");

  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: user.email,
      payment_intent_data: {
        application_fee_amount: Math.round((course.priceCents * PLATFORM_FEE_BPS) / 10_000),
        metadata: {
          userId: user.id,
          creatorId: course.creatorId,
          courseId: course.id,
        },
      },
      metadata: {
        kind: "course",
        userId: user.id,
        creatorId: course.creatorId,
        courseId: course.id,
      },
      success_url: `${APP_URL}/${course.creator.slug}/courses/${course.slug}?purchased=1`,
      cancel_url: `${APP_URL}/${course.creator.slug}/courses/${course.slug}`,
    },
    { stripeAccount: course.creator.stripeAccountId! },
  );

  if (!session.url) throw new Error("Stripe did not return a Checkout URL.");
  return { redirectUrl: session.url };
}
