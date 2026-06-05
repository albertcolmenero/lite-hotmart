/**
 * Idempotent Stripe sync helpers.
 *
 * - syncPlanToStripe(creator, plan):
 *   Ensures the creator's connected Stripe account has a Product + Prices that
 *   match the local Plan. Archive-and-replace on amount change (Stripe Prices
 *   are immutable). Grandfather existing subscriptions on the old Price.
 *
 * - syncCourseToStripe(creator, course):
 *   Same pattern, one Price per Course.
 *
 * - archiveStripePlan(creator, plan) / archiveStripeCourse(creator, course):
 *   Archive Product + Prices when a plan/course is deleted or deactivated.
 */

import Stripe from "stripe";
import { stripe } from "./stripe";
import { db } from "./db";
import type { Creator, Plan, Course, PlanPrice } from "@prisma/client";

type SyncResult = {
  productId: string | null;
  monthlyPriceId?: string | null;
  yearlyPriceId?: string | null;
  priceId?: string | null;
};

function reqOptions(creator: Creator): Stripe.RequestOptions {
  if (!creator.stripeAccountId) throw new Error("creator has no stripeAccountId");
  return { stripeAccount: creator.stripeAccountId };
}

/** True if the creator can have Stripe entities created on their behalf. */
export function creatorIsLive(creator: Creator): boolean {
  return Boolean(creator.stripeAccountId && creator.stripeOnboarded);
}

// ---------------------------------------------------------------- Plans

export async function syncPlanToStripe(creator: Creator, plan: Plan): Promise<void> {
  if (!creatorIsLive(creator)) return;

  // 1. Ensure Product exists
  let productId = plan.stripeProductId;
  if (!productId) {
    const product = await stripe.products.create(
      {
        name: `${creator.displayName} — membership`,
        metadata: { planId: plan.id, creatorId: creator.id, kind: "plan" },
      },
      reqOptions(creator),
    );
    productId = product.id;
    await db.plan.update({
      where: { id: plan.id },
      data: { stripeProductId: productId },
    });
  } else {
    // Keep product name up to date
    await stripe.products
      .update(productId, { name: `${creator.displayName} — membership` }, reqOptions(creator))
      .catch(() => undefined);
  }

  // 2. Reconcile each cadence (PlanPrice) → one Stripe Price, storing its id.
  const prices = await db.planPrice.findMany({ where: { planId: plan.id } });
  for (const pp of prices) {
    const stripePriceId = await reconcilePlanPrice(creator, productId, plan.currency, pp);
    if (stripePriceId !== pp.stripePriceId) {
      await db.planPrice.update({ where: { id: pp.id }, data: { stripePriceId } });
    }
  }
}

async function reconcilePlanPrice(
  creator: Creator,
  productId: string,
  currency: string,
  pp: PlanPrice,
): Promise<string | null> {
  // Inactive / zero → archive any existing Price.
  if (!pp.active || pp.priceCents <= 0) {
    if (pp.stripePriceId) {
      await stripe.prices
        .update(pp.stripePriceId, { active: false }, reqOptions(creator))
        .catch(() => undefined);
    }
    return null;
  }

  const recurring = {
    interval: pp.interval as "month" | "year",
    interval_count: pp.intervalCount,
  };

  // No prior Price → create.
  if (!pp.stripePriceId) {
    const price = await stripe.prices.create(
      { product: productId, unit_amount: pp.priceCents, currency, recurring },
      reqOptions(creator),
    );
    return price.id;
  }

  // Reuse if unchanged; else archive + recreate (grandfathers existing subs).
  const current = await stripe.prices
    .retrieve(pp.stripePriceId, undefined, reqOptions(creator))
    .catch(() => null);
  if (
    current &&
    current.active &&
    current.unit_amount === pp.priceCents &&
    current.currency === currency &&
    current.recurring?.interval === pp.interval &&
    current.recurring?.interval_count === pp.intervalCount
  ) {
    return current.id;
  }
  if (current) {
    await stripe.prices
      .update(pp.stripePriceId, { active: false }, reqOptions(creator))
      .catch(() => undefined);
  }
  const price = await stripe.prices.create(
    { product: productId, unit_amount: pp.priceCents, currency, recurring },
    reqOptions(creator),
  );
  return price.id;
}

// ---------------------------------------------------------------- Courses

export async function syncCourseToStripe(
  creator: Creator,
  course: Course,
): Promise<SyncResult | null> {
  if (!creatorIsLive(creator)) return null;

  // Product
  let productId = course.stripeProductId;
  if (!productId) {
    const product = await stripe.products.create(
      {
        name: course.title,
        metadata: { courseId: course.id, creatorId: creator.id, kind: "course" },
      },
      reqOptions(creator),
    );
    productId = product.id;
    await db.course.update({
      where: { id: course.id },
      data: { stripeProductId: productId },
    });
  } else {
    await stripe.products
      .update(productId, { name: course.title }, reqOptions(creator))
      .catch(() => undefined);
  }

  // Price — one-time, so similar reconcile logic without `recurring`
  let priceId = course.stripePriceId;
  if (!priceId) {
    const price = await stripe.prices.create(
      {
        product: productId,
        unit_amount: course.priceCents,
        currency: course.currency,
      },
      reqOptions(creator),
    );
    priceId = price.id;
  } else {
    const current = await stripe.prices
      .retrieve(priceId, undefined, reqOptions(creator))
      .catch(() => null);
    if (
      !current ||
      !current.active ||
      current.unit_amount !== course.priceCents ||
      current.currency !== course.currency
    ) {
      if (current) {
        await stripe.prices
          .update(priceId, { active: false }, reqOptions(creator))
          .catch(() => undefined);
      }
      const price = await stripe.prices.create(
        {
          product: productId,
          unit_amount: course.priceCents,
          currency: course.currency,
        },
        reqOptions(creator),
      );
      priceId = price.id;
    }
  }

  await db.course.update({
    where: { id: course.id },
    data: { stripeProductId: productId, stripePriceId: priceId },
  });

  return { productId, priceId };
}

// ---------------------------------------------------------------- Archive

export async function archiveStripePlan(creator: Creator, plan: Plan): Promise<void> {
  if (!creatorIsLive(creator)) return;
  const opts = reqOptions(creator);
  const prices = await db.planPrice.findMany({ where: { planId: plan.id } });
  for (const pp of prices) {
    if (pp.stripePriceId)
      await stripe.prices.update(pp.stripePriceId, { active: false }, opts).catch(() => undefined);
  }
  if (plan.stripeProductId) {
    await stripe.products
      .update(plan.stripeProductId, { active: false }, opts)
      .catch(() => undefined);
  }
}

export async function archiveStripeCourse(creator: Creator, course: Course): Promise<void> {
  if (!creatorIsLive(creator)) return;
  const opts = reqOptions(creator);
  if (course.stripePriceId) {
    await stripe.prices.update(course.stripePriceId, { active: false }, opts).catch(() => undefined);
  }
  if (course.stripeProductId) {
    await stripe.products
      .update(course.stripeProductId, { active: false }, opts)
      .catch(() => undefined);
  }
}
