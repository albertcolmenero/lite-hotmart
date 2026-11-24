/**
 * Flow tests for sale prices at checkout: payments.ts → stripe-sync → real
 * local Postgres, with a recording fake in place of the Stripe API. Covers the
 * coupon applied, its reuse and replacement, scheduled sales, the course fee,
 * the no-Stripe path, the webhook recording the discount, and cross-creator
 * guards.
 */
import type Stripe from "stripe";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Call = { method: string; params: Record<string, unknown>; opts?: Record<string, unknown> };

const fake = vi.hoisted(() => {
  const calls: Call[] = [];
  const prices = new Map<string, Record<string, unknown>>();
  const counters = { n: 0, coupons: 0 };
  const record = (method: string, params: unknown, opts?: unknown) =>
    calls.push({ method, params: params as Record<string, unknown>, opts: opts as Record<string, unknown> });
  const stripe = {
    products: {
      create: async (p: unknown, o: unknown) => (record("products.create", p, o), { id: `prod_new_${++counters.n}` }),
      update: async (id: string, p: unknown) => (record("products.update", { id, ...(p as object) }), { id }),
    },
    prices: {
      create: async (p: Record<string, unknown>, o: unknown) => {
        record("prices.create", p, o);
        const id = `price_new_${++counters.n}`;
        prices.set(id, { id, active: true, ...p });
        return { id };
      },
      retrieve: async (id: string) => {
        const p = prices.get(id);
        if (!p) throw new Error("no such price");
        return p;
      },
      update: async (id: string, p: Record<string, unknown>) => {
        record("prices.update", { id, ...p });
        prices.set(id, { ...prices.get(id), ...p });
        return { id };
      },
    },
    coupons: {
      create: async (p: unknown, o: unknown) => (record("coupons.create", p, o), { id: `coupon_${++counters.coupons}` }),
    },
    checkout: {
      sessions: {
        create: async (p: unknown, o: unknown) => (record("sessions.create", p, o), { url: "https://checkout.test/s" }),
      },
    },
  };
  const reset = () => {
    calls.length = 0;
    prices.clear();
    counters.n = 0;
    counters.coupons = 0;
  };
  return { calls, prices, stripe, reset };
});

vi.mock("@/lib/stripe", () => ({
  stripe: fake.stripe,
  PLATFORM_FEE_BPS: 800,
  applicationFeeAmount: (cents: number) => Math.round((cents * 800) / 10_000),
}));
vi.mock("@/lib/auth", () => ({ requireDbUser: vi.fn() }));
vi.mock("@/lib/creator-url", () => ({ creatorAbsoluteUrl: () => "http://localhost/storefront" }));

import { db } from "@/lib/db";
import { requireDbUser } from "@/lib/auth";
import { purchaseCourseAction, subscribeToCreatorAction } from "@/lib/payments";
import { syncSubscriptionFromStripe } from "@/lib/subscription-sync";
import { addMonthsUTC } from "@/lib/pricing";
import { seedCreator, stripeSub, truncateAll } from "./helpers";

const NOW = new Date("2026-11-27T12:00:00Z");
const HOUR = 3_600_000;
const at = (ms: number) => new Date(NOW.getTime() + ms);

const callsOf = (method: string) => fake.calls.filter((c) => c.method === method);
const lastSession = () =>
  callsOf("sessions.create").at(-1)!.params as unknown as Stripe.Checkout.SessionCreateParams;

async function seedLive(tag: string) {
  const s = await seedCreator(tag);
  // The connected account already has the cadence's Price (matches the row).
  fake.prices.set(`price_${tag}_v1`, {
    id: `price_${tag}_v1`,
    active: true,
    unit_amount: 1500,
    currency: "usd",
    recurring: { interval: "month", interval_count: 1 },
  });
  vi.mocked(requireDbUser).mockResolvedValue(s.buyer);
  return s;
}

async function putPlanOnSale(planPriceId: string, data: Record<string, unknown>) {
  return db.planPrice.update({
    where: { id: planPriceId },
    data: { salePriceCents: 900, saleDuration: "periods", salePeriods: 3, ...data },
  });
}

beforeEach(async () => {
  await truncateAll();
  fake.reset();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());
afterAll(() => db.$disconnect());

describe("subscribe checkout", () => {
  it("charges the regular price with no coupon when there is no sale", async () => {
    const a = await seedLive("a");
    await subscribeToCreatorAction({ creatorId: a.creator.id, planPriceId: a.planPrice.id });

    expect(callsOf("coupons.create")).toHaveLength(0);
    const s = lastSession();
    expect(s.line_items).toEqual([{ price: "price_a_v1", quantity: 1 }]);
    expect(s.discounts).toBeUndefined();
    expect(s.expires_at).toBeUndefined();
  });

  it("applies a coupon during a sale and records it on the cadence", async () => {
    const a = await seedLive("a");
    const end = at(5 * HOUR);
    await putPlanOnSale(a.planPrice.id, { saleEndsAt: end });

    await subscribeToCreatorAction({ creatorId: a.creator.id, planPriceId: a.planPrice.id });

    const [coupon] = callsOf("coupons.create");
    expect(coupon.params).toEqual({
      name: "Sale",
      amount_off: 600,
      currency: "usd",
      duration: "repeating",
      duration_in_months: 3,
      redeem_by: Math.floor(end.getTime() / 1000),
      applies_to: { products: ["prod_a"] },
    });
    expect(coupon.opts).toMatchObject({ stripeAccount: "acct_a" });

    const s = lastSession();
    expect(s.line_items).toEqual([{ price: "price_a_v1", quantity: 1 }]); // regular Price
    expect(s.discounts).toEqual([{ coupon: "coupon_1" }]);
    expect(s.expires_at).toBe(Math.floor(end.getTime() / 1000));
    expect(s.subscription_data?.metadata).toMatchObject({ discountCents: "600", discountPeriods: "3" });
    expect(s.subscription_data?.application_fee_percent).toBe(8);

    const pp = await db.planPrice.findUniqueOrThrow({ where: { id: a.planPrice.id } });
    expect(pp.saleStripeCouponId).toBe("coupon_1");
    expect(pp.saleCouponFingerprint).toContain('"amount_off":600');
  });

  it("reuses the coupon for later checkouts and replaces it when the sale changes", async () => {
    const a = await seedLive("a");
    await putPlanOnSale(a.planPrice.id, {});
    await subscribeToCreatorAction({ creatorId: a.creator.id, planPriceId: a.planPrice.id });
    await subscribeToCreatorAction({ creatorId: a.creator.id, planPriceId: a.planPrice.id });
    expect(callsOf("coupons.create")).toHaveLength(1);

    await db.planPrice.update({ where: { id: a.planPrice.id }, data: { salePriceCents: 1000 } });
    await subscribeToCreatorAction({ creatorId: a.creator.id, planPriceId: a.planPrice.id });

    const coupons = callsOf("coupons.create");
    expect(coupons).toHaveLength(2);
    expect(coupons[1].params.amount_off).toBe(500);
    expect(lastSession().discounts).toEqual([{ coupon: "coupon_2" }]);
  });

  it("uses distinct idempotency keys with and without a sale on the same day", async () => {
    const a = await seedLive("a");
    await subscribeToCreatorAction({ creatorId: a.creator.id, planPriceId: a.planPrice.id });
    await putPlanOnSale(a.planPrice.id, {});
    await subscribeToCreatorAction({ creatorId: a.creator.id, planPriceId: a.planPrice.id });
    const [k1, k2] = callsOf("sessions.create").map((c) => c.opts?.idempotencyKey);
    expect(k1).not.toBe(k2);
  });

  it("charges the regular price before a scheduled sale starts and after it ends", async () => {
    const a = await seedLive("a");
    await putPlanOnSale(a.planPrice.id, { saleStartsAt: at(HOUR), saleEndsAt: at(48 * HOUR) });
    await subscribeToCreatorAction({ creatorId: a.creator.id, planPriceId: a.planPrice.id });
    expect(lastSession().discounts).toBeUndefined();

    vi.setSystemTime(at(49 * HOUR));
    await subscribeToCreatorAction({ creatorId: a.creator.id, planPriceId: a.planPrice.id });
    expect(lastSession().discounts).toBeUndefined();
    expect(callsOf("coupons.create")).toHaveLength(0);
  });

  it("maps a forever sale to a forever coupon", async () => {
    const a = await seedLive("a");
    await putPlanOnSale(a.planPrice.id, { saleDuration: "forever", salePeriods: null });
    await subscribeToCreatorAction({ creatorId: a.creator.id, planPriceId: a.planPrice.id });
    expect(callsOf("coupons.create")[0].params).toMatchObject({ duration: "forever" });
    expect(lastSession().subscription_data?.metadata?.discountPeriods).toBe("forever");
  });

  it("records the discount locally when the creator isn't on Stripe yet", async () => {
    const a = await seedLive("a");
    await db.creator.update({ where: { id: a.creator.id }, data: { stripeOnboarded: false } });
    await putPlanOnSale(a.planPrice.id, {});

    const { subscriptionId } = await subscribeToCreatorAction({
      creatorId: a.creator.id,
      planPriceId: a.planPrice.id,
    });

    const sub = await db.subscription.findUniqueOrThrow({ where: { id: subscriptionId! } });
    expect(sub.discountCents).toBe(600);
    expect(sub.discountEndsAt?.toISOString()).toBe(addMonthsUTC(NOW, 3).toISOString());
    expect(fake.calls).toHaveLength(0);
  });

  it("refuses a billing option that belongs to another creator", async () => {
    const a = await seedLive("a");
    const b = await seedCreator("b");
    await expect(
      subscribeToCreatorAction({ creatorId: a.creator.id, planPriceId: b.planPrice.id }),
    ).rejects.toThrow();
    expect(callsOf("sessions.create")).toHaveLength(0);
  });
});

describe("course checkout", () => {
  async function seedCourse(tag: string, sale: Record<string, unknown> = {}) {
    const s = await seedLive(tag);
    const course = await db.course.create({
      data: {
        creatorId: s.creator.id,
        slug: `course-${tag}`,
        title: `Course ${tag}`,
        priceCents: 5000,
        published: true,
        ...sale,
      },
    });
    // Buying a course requires an active subscription to the creator.
    await db.entitlement.create({
      data: { userId: s.buyer.id, source: "subscription", creatorId: s.creator.id, expiresAt: at(30 * 24 * HOUR) },
    });
    return { ...s, course };
  }

  it("takes the platform fee on the sale price and applies a once coupon", async () => {
    const c = await seedCourse("a", { salePriceCents: 3000, saleEndsAt: at(3 * HOUR) });
    await purchaseCourseAction(c.course.id);

    expect(callsOf("coupons.create")[0].params).toMatchObject({ amount_off: 2000, duration: "once" });
    const s = lastSession();
    expect(s.discounts).toEqual([{ coupon: "coupon_1" }]);
    expect(s.payment_intent_data?.application_fee_amount).toBe(240); // 8% of 3000, not of 5000
    expect(s.expires_at).toBe(Math.floor(at(3 * HOUR).getTime() / 1000));
  });

  it("takes the fee on the regular price without a sale", async () => {
    const c = await seedCourse("a");
    await purchaseCourseAction(c.course.id);
    const s = lastSession();
    expect(s.discounts).toBeUndefined();
    expect(s.payment_intent_data?.application_fee_amount).toBe(400);
  });

  it("records the sale price on a purchase when the creator isn't on Stripe yet", async () => {
    const c = await seedCourse("a", { salePriceCents: 3000 });
    await db.creator.update({ where: { id: c.creator.id }, data: { stripeOnboarded: false } });
    const { purchaseId } = await purchaseCourseAction(c.course.id);
    const p = await db.purchase.findUniqueOrThrow({ where: { id: purchaseId! } });
    expect(p.amountCents).toBe(3000);
  });
});

describe("webhook records the subscriber's discount", () => {
  const T0 = Math.floor(NOW.getTime() / 1000);
  const DAY = 86_400;

  it("stores the discount, replays identically, and clears it when Stripe's discount is gone", async () => {
    const a = await seedLive("a");
    const event = stripeSub({
      id: "sub_1",
      priceId: "price_a_v1",
      userId: a.buyer.id,
      periodStart: T0,
      periodEnd: T0 + 30 * DAY,
      discounts: ["di_1"],
      extraMetadata: { discountCents: "600", discountPeriods: "3" },
    });

    await syncSubscriptionFromStripe(event, "acct_a");
    const first = await db.subscription.findUniqueOrThrow({ where: { stripeSubscriptionId: "sub_1" } });
    expect(first.discountCents).toBe(600);
    expect(first.discountEndsAt?.toISOString()).toBe(addMonthsUTC(NOW, 3).toISOString());

    vi.setSystemTime(at(10 * DAY * 1000)); // a later replay must not move the end
    await syncSubscriptionFromStripe(event, "acct_a");
    const replay = await db.subscription.findUniqueOrThrow({ where: { stripeSubscriptionId: "sub_1" } });
    expect(replay.discountEndsAt).toEqual(first.discountEndsAt);

    await syncSubscriptionFromStripe({ ...event, discounts: [] }, "acct_a");
    const cleared = await db.subscription.findUniqueOrThrow({ where: { stripeSubscriptionId: "sub_1" } });
    expect(cleared.discountCents).toBeNull();
    expect(cleared.discountEndsAt).toBeNull();
  });
});
