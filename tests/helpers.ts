/** Shared fixtures for flow tests (real local test database). */
import type Stripe from "stripe";
import { db } from "@/lib/db";

export async function truncateAll() {
  // Keep Prisma's migration history, or the next run re-applies 0_init.
  const rows = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (rows.length === 0) return;
  const list = rows.map((r) => `"public"."${r.tablename}"`).join(", ");
  await db.$executeRawUnsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
}

/** A creator with a live connected account, one monthly cadence, and a buyer. */
export async function seedCreator(tag: string) {
  const owner = await db.user.create({
    data: { clerkId: `clerk_owner_${tag}`, email: `owner_${tag}@test.local` },
  });
  const creator = await db.creator.create({
    data: {
      userId: owner.id,
      slug: `creator-${tag}`,
      displayName: `Creator ${tag}`,
      stripeAccountId: `acct_${tag}`,
      stripeOnboarded: true,
    },
  });
  const plan = await db.plan.create({
    data: { creatorId: creator.id, stripeProductId: `prod_${tag}` },
  });
  const planPrice = await db.planPrice.create({
    data: {
      planId: plan.id,
      interval: "month",
      intervalCount: 1,
      priceCents: 1500,
      stripePriceId: `price_${tag}_v1`,
    },
  });
  const buyer = await db.user.create({
    data: { clerkId: `clerk_buyer_${tag}`, email: `buyer_${tag}@test.local` },
  });
  return { creator, plan, planPrice, buyer };
}

export function stripeSub(opts: {
  id: string;
  priceId: string;
  userId: string;
  planPriceId?: string;
  status?: Stripe.Subscription.Status;
  periodStart: number;
  periodEnd: number;
  /** Subscription start (defaults to the first period start). */
  startDate?: number;
  /** Discount ids on the Stripe subscription (webhook payloads aren't expanded). */
  discounts?: string[];
  extraMetadata?: Record<string, string>;
}): Stripe.Subscription {
  return {
    id: opts.id,
    object: "subscription",
    customer: `cus_${opts.id}`,
    status: opts.status ?? "active",
    cancel_at_period_end: false,
    ended_at: null,
    start_date: opts.startDate ?? opts.periodStart,
    discounts: opts.discounts ?? [],
    metadata: {
      userId: opts.userId,
      ...(opts.planPriceId ? { planPriceId: opts.planPriceId } : {}),
      ...opts.extraMetadata,
    },
    items: {
      object: "list",
      data: [
        {
          price: { id: opts.priceId },
          current_period_start: opts.periodStart,
          current_period_end: opts.periodEnd,
        },
      ],
    },
  } as unknown as Stripe.Subscription;
}

