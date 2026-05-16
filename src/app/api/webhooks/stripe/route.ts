import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import type { BillingInterval, SubscriptionStatus } from "@prisma/client";

/**
 * Connect-aware Stripe webhook endpoint.
 *
 * Configure in Stripe with the events:
 *   - checkout.session.completed
 *   - customer.subscription.created
 *   - customer.subscription.updated
 *   - customer.subscription.deleted
 *   - invoice.payment_failed
 *   - account.updated
 *
 * Use "Connect" event mode so events from connected accounts hit this endpoint.
 * For local dev:
 *   stripe listen \
 *     --forward-to localhost:3000/api/webhooks/stripe \
 *     --forward-connect-to localhost:3000/api/webhooks/stripe
 */
export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) {
    return NextResponse.json({ error: "missing signature" }, { status: 400 });
  }

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    return NextResponse.json(
      { error: `signature verification failed: ${(err as Error).message}` },
      { status: 400 },
    );
  }

  const connectedAccountId = event.account; // present on Connect events
  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session, connectedAccountId);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionUpsert(event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case "invoice.payment_failed":
        await handleInvoiceFailed(event.data.object as Stripe.Invoice);
        break;
      case "account.updated":
        await handleAccountUpdated(event.data.object as Stripe.Account);
        break;
      default:
        // ignored
        break;
    }
  } catch (err) {
    console.error("[stripe webhook]", event.type, err);
    return NextResponse.json({ error: "handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

// ---------------------------------------------------------------- checkout

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  _connectedAccountId: string | undefined,
) {
  const meta = session.metadata ?? {};
  const kind = meta.kind;
  const userId = meta.userId;
  const creatorId = meta.creatorId;
  if (!userId || !creatorId || !kind) return;

  // ─── subscription
  if (kind === "subscription" && session.subscription) {
    // The subscription.created event will populate full details.
    // Here we just make sure we know the linkage from session.metadata.
    return;
  }

  // ─── one-time course purchase
  if (kind === "course" && session.payment_intent) {
    const courseId = meta.courseId;
    if (!courseId) return;
    const course = await db.course.findUnique({ where: { id: courseId } });
    if (!course) return;

    const piId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent.id;

    const purchase = await db.purchase.upsert({
      where: { stripePaymentIntentId: piId },
      update: {},
      create: {
        userId,
        courseId,
        amountCents: session.amount_total ?? course.priceCents,
        currency: session.currency ?? course.currency,
        stripePaymentIntentId: piId,
      },
    });

    await db.entitlement.upsert({
      where: { id: `purchase_${purchase.id}` },
      update: {},
      create: {
        id: `purchase_${purchase.id}`,
        userId,
        source: "purchase",
        purchaseId: purchase.id,
        courseId,
        expiresAt: null,
      },
    });
  }
}

// ---------------------------------------------------------------- subscriptions

async function handleSubscriptionUpsert(sub: Stripe.Subscription) {
  const priceId = sub.items.data[0]?.price.id;
  if (!priceId) return;

  // Find the local Plan by either monthly or yearly price id
  const plan = await db.plan.findFirst({
    where: {
      OR: [{ stripeMonthlyPriceId: priceId }, { stripeYearlyPriceId: priceId }],
    },
    include: { creator: true },
  });
  if (!plan) return;

  const interval: BillingInterval =
    plan.stripeYearlyPriceId === priceId ? "year" : "month";

  // Resolve our user id — first try subscription metadata (set at Checkout),
  // then fall back to the Customer email.
  let userId = (sub.metadata && sub.metadata.userId) || null;
  if (!userId && typeof sub.customer === "string") {
    const customer = await stripe.customers.retrieve(sub.customer, undefined, {
      stripeAccount: plan.creator.stripeAccountId ?? undefined,
    });
    if (customer && !customer.deleted && customer.email) {
      const u = await db.user.findUnique({ where: { email: customer.email } });
      if (u) userId = u.id;
    }
  }
  if (!userId) return;

  const status = sub.status as SubscriptionStatus;
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const item = sub.items.data[0];
  const periodStart = new Date(item.current_period_start * 1000);
  const periodEnd = new Date(item.current_period_end * 1000);

  const dbSub = await db.subscription.upsert({
    where: { stripeSubscriptionId: sub.id },
    update: {
      status,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      endedAt: sub.ended_at ? new Date(sub.ended_at * 1000) : null,
    },
    create: {
      userId,
      planId: plan.id,
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

  // Entitlement keyed deterministically by subscription
  const entId = `sub_${dbSub.id}`;
  const isActive = status === "active" || status === "trialing";
  if (isActive) {
    await db.entitlement.upsert({
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
    // Past-due / unpaid / canceled — let entitlement expire at current period end
    await db.entitlement.updateMany({
      where: { id: entId },
      data: { expiresAt: periodEnd },
    });
  }
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  const dbSub = await db.subscription.findUnique({
    where: { stripeSubscriptionId: sub.id },
  });
  if (!dbSub) return;
  await db.subscription.update({
    where: { id: dbSub.id },
    data: {
      status: "canceled",
      endedAt: sub.ended_at ? new Date(sub.ended_at * 1000) : new Date(),
    },
  });
  // Keep entitlement active until current period end (already set on last update)
}

async function handleInvoiceFailed(invoice: Stripe.Invoice) {
  const subId =
    typeof (invoice as Stripe.Invoice & { subscription?: string | Stripe.Subscription })
      .subscription === "string"
      ? ((invoice as Stripe.Invoice & { subscription?: string }).subscription as string)
      : (invoice as Stripe.Invoice & { subscription?: Stripe.Subscription }).subscription?.id;
  if (!subId) return;
  await db.subscription.updateMany({
    where: { stripeSubscriptionId: subId },
    data: { status: "past_due" },
  });
}

// ---------------------------------------------------------------- account.updated

async function handleAccountUpdated(account: Stripe.Account) {
  const onboarded = Boolean(account.details_submitted && account.charges_enabled);
  await db.creator.updateMany({
    where: { stripeAccountId: account.id },
    data: { stripeOnboarded: onboarded },
  });
}
