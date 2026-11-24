/**
 * Flow tests for the Stripe subscription → local Subscription/Entitlement sync,
 * against a real (local, disposable) Postgres. Covers the renewal-on-archived-
 * price bug, cross-creator isolation, status mapping, replay idempotency, and
 * the signed webhook endpoint end to end.
 */
import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { syncSubscriptionFromStripe } from "@/lib/subscription-sync";
import { POST as stripeWebhook } from "@/app/api/webhooks/stripe/route";
import { seedCreator, stripeSub, truncateAll } from "./helpers";

const DAY = 86_400;
const T0 = 1_790_000_000; // fixed epoch seconds — no Date.now() anchors

async function entitlementFor(stripeSubscriptionId: string) {
  const sub = await db.subscription.findUnique({
    where: { stripeSubscriptionId },
    include: { entitlements: true },
  });
  return { sub, ent: sub?.entitlements[0] ?? null };
}

/** Simulate the creator changing the amount: sync archives v1, stores v2. */
async function repriceTo(planPriceId: string, newStripePriceId: string) {
  await db.planPrice.update({
    where: { id: planPriceId },
    data: { priceCents: 1900, stripePriceId: newStripePriceId },
  });
}

beforeEach(truncateAll);
afterAll(() => db.$disconnect());

describe("syncSubscriptionFromStripe", () => {
  it("records a new subscription on the cadence's current price", async () => {
    const a = await seedCreator("a");
    const out = await syncSubscriptionFromStripe(
      stripeSub({ id: "sub_1", priceId: "price_a_v1", userId: a.buyer.id, periodStart: T0, periodEnd: T0 + 30 * DAY }),
      "acct_a",
    );
    expect(out.kind).toBe("synced");
    const { sub, ent } = await entitlementFor("sub_1");
    expect(sub?.planPriceId).toBe(a.planPrice.id);
    expect(ent?.expiresAt?.getTime()).toBe((T0 + 30 * DAY) * 1000);
  });

  it("extends access on renewal after the creator repriced (archived Price)", async () => {
    const a = await seedCreator("a");
    await syncSubscriptionFromStripe(
      stripeSub({ id: "sub_1", priceId: "price_a_v1", userId: a.buyer.id, periodStart: T0, periodEnd: T0 + 30 * DAY }),
      "acct_a",
    );
    await repriceTo(a.planPrice.id, "price_a_v2");

    // Renewal still bills on the grandfathered v1 Price.
    const out = await syncSubscriptionFromStripe(
      stripeSub({ id: "sub_1", priceId: "price_a_v1", userId: a.buyer.id, periodStart: T0 + 30 * DAY, periodEnd: T0 + 60 * DAY }),
      "acct_a",
    );
    expect(out.kind).toBe("synced");
    const { sub, ent } = await entitlementFor("sub_1");
    expect(sub?.planPriceId).toBe(a.planPrice.id);
    expect(sub?.stripePriceId).toBe("price_a_v1");
    expect(ent?.expiresAt?.getTime()).toBe((T0 + 60 * DAY) * 1000);
  });

  it("records a first-seen subscription on an archived Price via checkout metadata", async () => {
    const a = await seedCreator("a");
    await repriceTo(a.planPrice.id, "price_a_v2");
    const out = await syncSubscriptionFromStripe(
      stripeSub({
        id: "sub_1",
        priceId: "price_a_v1",
        userId: a.buyer.id,
        planPriceId: a.planPrice.id,
        periodStart: T0,
        periodEnd: T0 + 30 * DAY,
      }),
      "acct_a",
    );
    expect(out.kind).toBe("synced");
  });

  it("never resolves another creator's plan (metadata or price id from a foreign account)", async () => {
    const a = await seedCreator("a");
    const b = await seedCreator("b");

    const viaMetadata = await syncSubscriptionFromStripe(
      stripeSub({
        id: "sub_evil_1",
        priceId: "price_b_custom",
        userId: b.buyer.id,
        planPriceId: a.planPrice.id,
        periodStart: T0,
        periodEnd: T0 + 30 * DAY,
      }),
      "acct_b",
    );
    const viaPriceId = await syncSubscriptionFromStripe(
      stripeSub({ id: "sub_evil_2", priceId: "price_a_v1", userId: b.buyer.id, periodStart: T0, periodEnd: T0 + 30 * DAY }),
      "acct_b",
    );

    expect(viaMetadata).toEqual({ kind: "skipped", reason: "unknown_price" });
    expect(viaPriceId).toEqual({ kind: "skipped", reason: "unknown_price" });
    expect(await db.subscription.count()).toBe(0);
    expect(await db.entitlement.count()).toBe(0);
  });

  it("maps Stripe statuses our enum lacks instead of failing", async () => {
    const a = await seedCreator("a");
    const paused = await syncSubscriptionFromStripe(
      stripeSub({ id: "sub_p", priceId: "price_a_v1", userId: a.buyer.id, status: "paused", periodStart: T0, periodEnd: T0 + 30 * DAY }),
      "acct_a",
    );
    const expired = await syncSubscriptionFromStripe(
      stripeSub({ id: "sub_x", priceId: "price_a_v1", userId: a.buyer.id, status: "incomplete_expired", periodStart: T0, periodEnd: T0 + 30 * DAY }),
      "acct_a",
    );
    expect(paused.kind === "synced" && paused.status).toBe("past_due");
    expect(expired.kind === "synced" && expired.status).toBe("canceled");
  });

  it("is idempotent: replaying the same event leaves identical rows", async () => {
    const a = await seedCreator("a");
    const event = stripeSub({ id: "sub_1", priceId: "price_a_v1", userId: a.buyer.id, periodStart: T0, periodEnd: T0 + 30 * DAY });
    await syncSubscriptionFromStripe(event, "acct_a");
    const first = await entitlementFor("sub_1");
    await syncSubscriptionFromStripe(event, "acct_a");
    const second = await entitlementFor("sub_1");

    expect(await db.subscription.count()).toBe(1);
    expect(await db.entitlement.count()).toBe(1);
    const strip = (s: typeof first.sub) => s && { ...s, updatedAt: null, entitlements: null };
    expect(strip(second.sub)).toEqual(strip(first.sub));
    expect(second.ent).toEqual(first.ent);
  });

  it("dry run resolves without writing", async () => {
    const a = await seedCreator("a");
    const out = await syncSubscriptionFromStripe(
      stripeSub({ id: "sub_1", priceId: "price_a_v1", userId: a.buyer.id, periodStart: T0, periodEnd: T0 + 30 * DAY }),
      "acct_a",
      { dryRun: true },
    );
    expect(out.kind).toBe("would_sync");
    expect(await db.subscription.count()).toBe(0);
  });
});

describe("POST /api/webhooks/stripe (signed)", () => {
  function signedRequest(event: object) {
    const payload = JSON.stringify(event);
    const header = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: process.env.STRIPE_WEBHOOK_SECRET!,
    });
    return new NextRequest("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body: payload,
      headers: { "stripe-signature": header, "content-type": "application/json" },
    });
  }

  it("extends access on a renewal event for a grandfathered Price", async () => {
    const a = await seedCreator("a");
    await syncSubscriptionFromStripe(
      stripeSub({ id: "sub_1", priceId: "price_a_v1", userId: a.buyer.id, periodStart: T0, periodEnd: T0 + 30 * DAY }),
      "acct_a",
    );
    await repriceTo(a.planPrice.id, "price_a_v2");

    const res = await stripeWebhook(
      signedRequest({
        id: "evt_1",
        object: "event",
        type: "customer.subscription.updated",
        account: "acct_a",
        data: {
          object: stripeSub({ id: "sub_1", priceId: "price_a_v1", userId: a.buyer.id, periodStart: T0 + 30 * DAY, periodEnd: T0 + 60 * DAY }),
        },
      }),
    );
    expect(res.status).toBe(200);
    const { ent } = await entitlementFor("sub_1");
    expect(ent?.expiresAt?.getTime()).toBe((T0 + 60 * DAY) * 1000);
  });

  it("ignores a subscription event with no connected account", async () => {
    const a = await seedCreator("a");
    const res = await stripeWebhook(
      signedRequest({
        id: "evt_2",
        object: "event",
        type: "customer.subscription.created",
        data: {
          object: stripeSub({ id: "sub_1", priceId: "price_a_v1", userId: a.buyer.id, periodStart: T0, periodEnd: T0 + 30 * DAY }),
        },
      }),
    );
    expect(res.status).toBe(200);
    expect(await db.subscription.count()).toBe(0);
  });
});
