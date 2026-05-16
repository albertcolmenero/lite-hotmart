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
import type { Creator, Plan, Course } from "@prisma/client";

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

export async function syncPlanToStripe(
  creator: Creator,
  plan: Plan,
): Promise<SyncResult | null> {
  if (!creatorIsLive(creator)) return null;

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

  // 2. Reconcile each interval's Price
  const monthlyPriceId = await reconcilePrice({
    creator,
    productId,
    existingPriceId: plan.stripeMonthlyPriceId,
    amountCents: plan.monthlyPriceCents,
    interval: "month",
    currency: plan.currency,
    trialDays: plan.trialDays,
  });
  const yearlyPriceId = await reconcilePrice({
    creator,
    productId,
    existingPriceId: plan.stripeYearlyPriceId,
    amountCents: plan.yearlyPriceCents,
    interval: "year",
    currency: plan.currency,
    trialDays: plan.trialDays,
  });

  await db.plan.update({
    where: { id: plan.id },
    data: { stripeMonthlyPriceId: monthlyPriceId, stripeYearlyPriceId: yearlyPriceId },
  });

  return { productId, monthlyPriceId, yearlyPriceId };
}

async function reconcilePrice(params: {
  creator: Creator;
  productId: string;
  existingPriceId: string | null;
  amountCents: number | null;
  interval: "month" | "year";
  currency: string;
  trialDays: number;
}): Promise<string | null> {
  const { creator, productId, existingPriceId, amountCents, interval, currency } = params;

  // Plan price unset → archive any existing Price, return null
  if (amountCents == null || amountCents <= 0) {
    if (existingPriceId) {
      await stripe.prices
        .update(existingPriceId, { active: false }, reqOptions(creator))
        .catch(() => undefined);
    }
    return null;
  }

  // No prior Price → create
  if (!existingPriceId) {
    const price = await stripe.prices.create(
      {
        product: productId,
        unit_amount: amountCents,
        currency,
        recurring: { interval },
      },
      reqOptions(creator),
    );
    return price.id;
  }

  // Have prior Price — check if amount matches; if so reuse, otherwise archive + recreate
  const current = await stripe.prices
    .retrieve(existingPriceId, undefined, reqOptions(creator))
    .catch(() => null);
  if (current && current.active && current.unit_amount === amountCents && current.currency === currency) {
    return current.id;
  }
  // archive the old one (preserves grandfathered subs)
  if (current) {
    await stripe.prices
      .update(existingPriceId, { active: false }, reqOptions(creator))
      .catch(() => undefined);
  }
  const price = await stripe.prices.create(
    {
      product: productId,
      unit_amount: amountCents,
      currency,
      recurring: { interval },
    },
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
  for (const id of [plan.stripeMonthlyPriceId, plan.stripeYearlyPriceId]) {
    if (id) await stripe.prices.update(id, { active: false }, opts).catch(() => undefined);
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
