"use server";

import { db } from "./db";
import { requireDbUser } from "./auth";
import { BYPASS_PAYMENTS } from "./dev-auth";
import { stripe, PLATFORM_FEE_BPS, applicationFeeAmount } from "./stripe";
import {
  syncPlanToStripe,
  syncCourseToStripe,
  creatorIsLive,
  ensurePlanPriceSaleCoupon,
  ensureCourseSaleCoupon,
} from "./stripe-sync";
import {
  checkoutExpiresAt,
  effectivePlanPrice,
  effectivePrice,
  saleSubscriptionMetadata,
  subscriberDiscount,
} from "./pricing";
import { cadenceMonths } from "./billing-cadences";
import { creatorAbsoluteUrl } from "./creator-url";
import { APP_URL } from "./app-url";

/**
 * Per-day bucket for Checkout idempotency keys. A double-click the same day
 * reuses the same Stripe Checkout Session (no duplicate session); a genuine
 * retry tomorrow gets a fresh one. This is a "happened ~now" dedup window, not
 * a persisted recomputed deadline, so deriving it from the clock is fine.
 */
function dayBucket(): string {
  return new Date().toISOString().slice(0, 10);
}

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
  planPriceId: string;
}): Promise<SubscribeResult> {
  const user = await requireDbUser();
  const planPrice = await db.planPrice.findUnique({
    where: { id: input.planPriceId },
    include: { plan: { include: { creator: true } } },
  });
  if (!planPrice || !planPrice.active || planPrice.priceCents <= 0) {
    throw new Error("This billing option is unavailable.");
  }
  const plan = planPrice.plan;
  // Guard: the price must belong to the creator the caller named.
  if (!plan.active || plan.creatorId !== input.creatorId) {
    throw new Error("This creator has no active plan.");
  }
  const creator = plan.creator;
  // Stripe enum is the base interval; the full cadence lives on planPrice.
  const baseInterval = planPrice.interval === "year" ? "year" : "month";
  const periodMonths = cadenceMonths(planPrice.interval, planPrice.intervalCount);
  // One clock reading for the whole request: the sale is on or off for all of it.
  const now = new Date();

  const useStripe = !BYPASS_PAYMENTS && creatorIsLive(creator);

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

    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + periodMonths);
    // Same rule the webhook applies to Stripe subscriptions.
    const price = effectivePlanPrice(planPrice, now);
    const discount = subscriberDiscount({
      hasStripeDiscount: price.onSale,
      metadata: saleSubscriptionMetadata(price),
      start: now,
      periodMonths,
    });

    const sub = await db.subscription.create({
      data: {
        userId: user.id,
        planId: plan.id,
        planPriceId: planPrice.id,
        interval: baseInterval,
        status: "active",
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        discountCents: discount.discountCents,
        discountEndsAt: discount.discountEndsAt,
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
  // Make sure the Plan's Prices exist on the connected account, then read back
  // the Stripe Price id for this cadence.
  await syncPlanToStripe(creator, plan);
  const fresh = await db.planPrice.findUnique({
    where: { id: planPrice.id },
    include: { plan: true },
  });
  const priceId = fresh?.stripePriceId;
  if (!fresh || !priceId) throw new Error("Stripe price not configured for this billing option.");

  // Sale: regular Price + coupon. Charge, coupon, and metadata all come from
  // the same effective price so what's shown is what's billed.
  const price = effectivePlanPrice(fresh, now);
  const couponId =
    price.onSale && price.terms
      ? await ensurePlanPriceSaleCoupon(creator, fresh.plan, fresh, {
          salePriceCents: price.priceCents,
          terms: price.terms,
        })
      : null;
  const expiresAt = couponId ? checkoutExpiresAt(price.saleEndsAt, now) : undefined;

  const session = await stripe.checkout.sessions.create(
    {
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      ...(couponId ? { discounts: [{ coupon: couponId }] } : {}),
      ...(expiresAt ? { expires_at: expiresAt } : {}),
      customer_email: user.email,
      subscription_data: {
        application_fee_percent: PLATFORM_FEE_BPS / 100,
        trial_period_days: plan.trialDays > 0 ? plan.trialDays : undefined,
        metadata: {
          userId: user.id,
          creatorId: plan.creatorId,
          planId: plan.id,
          planPriceId: planPrice.id,
          ...(couponId ? saleSubscriptionMetadata(price) : {}),
        },
      },
      metadata: {
        kind: "subscription",
        userId: user.id,
        creatorId: plan.creatorId,
        planId: plan.id,
        planPriceId: planPrice.id,
      },
      // Success → root library (auth-gated, Clerk session lives on root).
      // Cancel → the creator's own storefront (custom domain if active).
      success_url: `${APP_URL}/library/${creator.slug}?subscribed=1`,
      cancel_url: creatorAbsoluteUrl(creator),
    },
    {
      stripeAccount: creator.stripeAccountId!,
      // Includes the coupon and expiry: Stripe rejects a reused key whose
      // params differ, e.g. a double click straddling a sale's start.
      idempotencyKey: `sub_${user.id}_${planPrice.id}_${dayBucket()}_${couponId ?? "list"}${
        expiresAt ? `_${expiresAt}` : ""
      }`,
    },
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
  const now = new Date();
  const price = effectivePrice(course, now);

  // ────────────────────────────── Bypass path
  if (!useStripe) {
    const purchase = await db.purchase.create({
      data: {
        userId: user.id,
        courseId,
        amountCents: price.priceCents,
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
  const productId = syncResult?.productId ?? course.stripeProductId;
  if (price.onSale && !productId) throw new Error("Stripe product not configured for this course.");

  const couponId =
    price.onSale && productId
      ? await ensureCourseSaleCoupon(course.creator, course, productId, price.priceCents)
      : null;
  const expiresAt = couponId ? checkoutExpiresAt(price.saleEndsAt, now) : undefined;

  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      ...(couponId ? { discounts: [{ coupon: couponId }] } : {}),
      ...(expiresAt ? { expires_at: expiresAt } : {}),
      customer_email: user.email,
      payment_intent_data: {
        // Fee on what the buyer actually pays (the sale price during a sale).
        application_fee_amount: applicationFeeAmount(price.priceCents),
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
      cancel_url: creatorAbsoluteUrl(course.creator, `/courses/${course.slug}`),
    },
    {
      stripeAccount: course.creator.stripeAccountId!,
      idempotencyKey: `course_${user.id}_${course.id}_${dayBucket()}_${couponId ?? "list"}${
        expiresAt ? `_${expiresAt}` : ""
      }`,
    },
  );

  if (!session.url) throw new Error("Stripe did not return a Checkout URL.");
  return { redirectUrl: session.url };
}
