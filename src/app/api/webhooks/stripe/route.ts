import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { z } from "zod";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { log } from "@/lib/log";
import type { BillingInterval, SubscriptionStatus } from "@prisma/client";

/**
 * Connect-aware Stripe webhook endpoint.
 *
 * Events handled:
 *   - checkout.session.completed             linkage + one-time course purchase
 *   - customer.subscription.created/updated  sync status, period, entitlement
 *   - customer.subscription.deleted          cancel
 *   - invoice.payment_failed                 mark past_due
 *   - charge.refunded                        revoke access on a FULL refund
 *   - charge.dispute.created                 revoke access when a dispute opens
 *   - account.updated                        sync onboarding / restriction state
 *   - account.application.deauthorized       creator disconnected → clear link
 *
 * Idempotency: every state-mutating handler is keyed on a Stripe id via
 * `upsert` / `updateMany`, so duplicate deliveries replay safely. Multi-row
 * writes run inside `db.$transaction` so a mid-handler crash can't leave half
 * state. On handler error we return 500 so Stripe retries.
 *
 * Use "Connect" event mode so events from connected accounts hit this endpoint.
 * Local dev:
 *   stripe listen \
 *     --forward-to localhost:3000/api/webhooks/stripe \
 *     --forward-connect-to localhost:3000/api/webhooks/stripe
 */

// Metadata we set on Checkout Sessions in payments.ts. Validated before trust.
const checkoutMetaSchema = z.object({
  kind: z.enum(["subscription", "course"]),
  userId: z.string().min(1),
  creatorId: z.string().min(1),
  planId: z.string().optional(),
  interval: z.enum(["month", "year"]).optional(),
  courseId: z.string().optional(),
});

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

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
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
      case "charge.refunded":
        await handleChargeRefunded(event.data.object as Stripe.Charge);
        break;
      case "charge.dispute.created":
        await handleDisputeCreated(event.data.object as Stripe.Dispute);
        break;
      case "account.updated":
        await handleAccountUpdated(event.data.object as Stripe.Account);
        break;
      case "account.application.deauthorized":
        await handleAppDeauthorized(event.account);
        break;
      default:
        // ignored
        break;
    }
  } catch (err) {
    log("error", "stripe webhook handler failed", {
      type: event.type,
      eventId: event.id,
      account: event.account ?? null,
      error: (err as Error).message,
    });
    return NextResponse.json({ error: "handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

// ---------------------------------------------------------------- checkout

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const parsed = checkoutMetaSchema.safeParse(session.metadata ?? {});
  if (!parsed.success) {
    log("warn", "checkout.session.completed: unrecognized metadata; ignoring", {
      sessionId: session.id,
      invalidFields: parsed.error.issues.map((i) => i.path.join(".")),
    });
    return;
  }
  const meta = parsed.data;

  // Subscriptions: full details arrive via customer.subscription.created.
  if (meta.kind === "subscription") return;

  // One-time course purchase.
  if (meta.kind === "course" && session.payment_intent) {
    const courseId = meta.courseId;
    if (!courseId) {
      log("warn", "course checkout missing courseId metadata", { sessionId: session.id });
      return;
    }
    const course = await db.course.findUnique({ where: { id: courseId } });
    if (!course) {
      log("warn", "course checkout for unknown course", { courseId, sessionId: session.id });
      return;
    }

    const piId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent.id;

    await db.$transaction(async (tx) => {
      const purchase = await tx.purchase.upsert({
        where: { stripePaymentIntentId: piId },
        update: {},
        create: {
          userId: meta.userId,
          courseId,
          amountCents: session.amount_total ?? course.priceCents,
          currency: session.currency ?? course.currency,
          stripePaymentIntentId: piId,
        },
      });
      await tx.entitlement.upsert({
        where: { id: `purchase_${purchase.id}` },
        update: {},
        create: {
          id: `purchase_${purchase.id}`,
          userId: meta.userId,
          source: "purchase",
          purchaseId: purchase.id,
          courseId,
          expiresAt: null,
        },
      });
    });
    log("info", "course purchase recorded", { courseId, userId: meta.userId, piId });
  }
}

// ---------------------------------------------------------------- subscriptions

async function handleSubscriptionUpsert(sub: Stripe.Subscription) {
  const priceId = sub.items.data[0]?.price.id;
  if (!priceId) return;

  // Find the local Plan by either monthly or yearly price id.
  const plan = await db.plan.findFirst({
    where: {
      OR: [{ stripeMonthlyPriceId: priceId }, { stripeYearlyPriceId: priceId }],
    },
    include: { creator: true },
  });
  if (!plan) {
    log("warn", "subscription event for unknown price", { priceId, subId: sub.id });
    return;
  }

  const interval: BillingInterval =
    plan.stripeYearlyPriceId === priceId ? "year" : "month";

  // Resolve our user id — first from subscription metadata (set at Checkout),
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
  if (!userId) {
    log("warn", "could not resolve user for subscription", { subId: sub.id });
    return;
  }

  const status = sub.status as SubscriptionStatus;
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const item = sub.items.data[0];
  const periodStart = new Date(item.current_period_start * 1000);
  const periodEnd = new Date(item.current_period_end * 1000);
  const isActive = status === "active" || status === "trialing";

  await db.$transaction(async (tx) => {
    const dbSub = await tx.subscription.upsert({
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
  // Entitlement stays active until current period end (set on the last update).
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

// ---------------------------------------------------------------- refunds & disputes

async function handleChargeRefunded(charge: Stripe.Charge) {
  // Only a FULL refund revokes access; a partial refund leaves it intact.
  const amount = charge.amount ?? 0;
  const refunded = charge.amount_refunded ?? 0;
  if (amount <= 0 || refunded < amount) {
    log("info", "charge.refunded (partial or zero) — no revocation", {
      chargeId: charge.id,
      amount,
      refunded,
    });
    return;
  }
  const piId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : charge.payment_intent?.id;
  if (!piId) return;
  await revokeByPaymentIntent(piId, "refund");
}

async function handleDisputeCreated(dispute: Stripe.Dispute) {
  const piId =
    typeof dispute.payment_intent === "string"
      ? dispute.payment_intent
      : dispute.payment_intent?.id;
  if (!piId) {
    log("info", "dispute.created without payment_intent", { disputeId: dispute.id });
    return;
  }
  await revokeByPaymentIntent(piId, "dispute");
  // TODO(emails): notify the creator a dispute was opened (runbook Phase 4).
}

/**
 * Revoke the entitlement granted by the purchase behind a PaymentIntent, by
 * expiring it now. Idempotent — only touches still-active entitlements.
 * (Subscription refunds/disputes are handled via the subscription lifecycle
 * events; this targets one-time course purchases.)
 */
async function revokeByPaymentIntent(piId: string, reason: string) {
  const purchase = await db.purchase.findUnique({
    where: { stripePaymentIntentId: piId },
  });
  if (!purchase) {
    log("info", "no local purchase for payment_intent; nothing to revoke", { piId, reason });
    return;
  }
  const res = await db.entitlement.updateMany({
    where: {
      purchaseId: purchase.id,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    data: { expiresAt: new Date() },
  });
  log("info", "revoked purchase entitlement", {
    reason,
    purchaseId: purchase.id,
    revoked: res.count,
  });
}

// ---------------------------------------------------------------- account.updated

async function handleAccountUpdated(account: Stripe.Account) {
  const onboarded = Boolean(account.details_submitted && account.charges_enabled);
  const disabledReason = account.requirements?.disabled_reason ?? null;

  // charges_enabled already drops to false when an account is restricted, so
  // `onboarded` going false hides subscribe buttons on the storefront. We log
  // the reason for operability; surfacing it in the UI needs a schema column
  // (deferred — see runbook Phase 2.3).
  await db.creator.updateMany({
    where: { stripeAccountId: account.id },
    data: { stripeOnboarded: onboarded },
  });

  if (!onboarded && disabledReason) {
    log("warn", "connected account restricted", {
      accountId: account.id,
      disabledReason,
    });
  }
}

// ---------------------------------------------------------------- deauthorized

// A Standard creator disconnected our platform from their own Stripe dashboard.
// Clear the link so the storefront hides subscribe buttons and they can
// reconnect cleanly.
async function handleAppDeauthorized(accountId: string | undefined) {
  if (!accountId) return;
  const res = await db.creator.updateMany({
    where: { stripeAccountId: accountId },
    data: { stripeAccountId: null, stripeOnboarded: false, stripeAccountCountry: null },
  });
  log("info", "creator disconnected stripe (deauthorized)", {
    accountId,
    cleared: res.count,
  });
}
