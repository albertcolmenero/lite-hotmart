import { describe, expect, it } from "vitest";
import {
  MAX_SALE_PERIODS,
  addMonthsUTC,
  checkoutExpiresAt,
  saleCouponSpec,
  saleSubscriptionMetadata,
  subscriberDiscount,
  effectivePlanPrice,
  effectivePrice,
  saleTerms,
  validateSale,
  type PlanSaleFields,
  type SaleFields,
} from "@/lib/pricing";

const NOW = new Date("2026-11-27T12:00:00Z");
const before = (ms: number) => new Date(NOW.getTime() - ms);
const after = (ms: number) => new Date(NOW.getTime() + ms);
const HOUR = 3_600_000;

const course = (o: Partial<SaleFields> = {}): SaleFields => ({
  priceCents: 5000,
  salePriceCents: 3000,
  saleStartsAt: null,
  saleEndsAt: null,
  ...o,
});
const cadence = (o: Partial<PlanSaleFields> = {}): PlanSaleFields => ({
  ...course({ priceCents: 1500, salePriceCents: 900 }),
  saleDuration: "periods",
  salePeriods: 3,
  ...o,
});

describe("effectivePrice", () => {
  it("returns the list price when there is no sale", () => {
    expect(effectivePrice(course({ salePriceCents: null }), NOW)).toEqual({
      priceCents: 5000,
      listPriceCents: null,
      onSale: false,
      saleEndsAt: null,
    });
  });

  it("returns the sale price with the list price for strike-through", () => {
    const end = after(HOUR);
    expect(effectivePrice(course({ saleEndsAt: end }), NOW)).toEqual({
      priceCents: 3000,
      listPriceCents: 5000,
      onSale: true,
      saleEndsAt: end,
    });
  });

  it("treats the window as [start, end): active at start, inactive at end", () => {
    expect(effectivePrice(course({ saleStartsAt: NOW }), NOW).onSale).toBe(true);
    expect(effectivePrice(course({ saleEndsAt: NOW }), NOW).onSale).toBe(false);
  });

  it("is not active before a scheduled start or after the end", () => {
    expect(effectivePrice(course({ saleStartsAt: after(1) }), NOW).onSale).toBe(false);
    expect(effectivePrice(course({ saleEndsAt: before(1) }), NOW).onSale).toBe(false);
  });

  it("fails closed when the stored sale isn't below the list price or isn't positive", () => {
    expect(effectivePrice(course({ salePriceCents: 5000 }), NOW).priceCents).toBe(5000);
    expect(effectivePrice(course({ salePriceCents: 6000 }), NOW).priceCents).toBe(5000);
    expect(effectivePrice(course({ salePriceCents: 0 }), NOW).priceCents).toBe(5000);
  });

  it("fails closed when the list price was lowered below an existing sale", () => {
    expect(effectivePrice(course({ priceCents: 2500, salePriceCents: 3000 }), NOW).onSale).toBe(false);
  });

  it("is deterministic for the same inputs", () => {
    const item = course({ saleStartsAt: before(HOUR), saleEndsAt: after(HOUR) });
    expect(effectivePrice(item, NOW)).toEqual(effectivePrice(item, NOW));
  });
});

describe("effectivePlanPrice / saleTerms", () => {
  it("carries the duration terms while on sale", () => {
    expect(effectivePlanPrice(cadence(), NOW)).toMatchObject({
      priceCents: 900,
      listPriceCents: 1500,
      onSale: true,
      terms: { kind: "periods", periods: 3 },
    });
    expect(effectivePlanPrice(cadence({ saleDuration: "forever", salePeriods: null }), NOW).terms).toEqual({
      kind: "forever",
    });
  });

  it("fails closed when a plan sale has no usable duration", () => {
    for (const bad of [
      { saleDuration: null, salePeriods: null },
      { saleDuration: "periods" as const, salePeriods: null },
      { saleDuration: "periods" as const, salePeriods: 0 },
      { saleDuration: "periods" as const, salePeriods: MAX_SALE_PERIODS + 1 },
    ]) {
      const p = effectivePlanPrice(cadence(bad), NOW);
      expect(p).toMatchObject({ priceCents: 1500, onSale: false, terms: null });
    }
  });

  it("has no terms outside the sale window", () => {
    expect(effectivePlanPrice(cadence({ saleEndsAt: before(1) }), NOW).terms).toBeNull();
  });

  it("saleTerms reads periods and forever", () => {
    expect(saleTerms({ saleDuration: "periods", salePeriods: 1 })).toEqual({ kind: "periods", periods: 1 });
    expect(saleTerms({ saleDuration: "forever", salePeriods: null })).toEqual({ kind: "forever" });
  });
});

describe("validateSale", () => {
  const plan = { listPriceCents: 1500, salePriceCents: 900, saleStartsAt: null, saleEndsAt: null };
  const fields = (errs: { field: string }[]) => errs.map((e) => e.field);

  it("accepts a valid plan sale and a valid course sale", () => {
    expect(validateSale({ ...plan, saleDuration: "periods", salePeriods: 3 }, "plan", NOW)).toEqual([]);
    expect(validateSale({ ...plan, saleDuration: "forever" }, "plan", NOW)).toEqual([]);
    expect(validateSale({ ...plan, saleEndsAt: after(HOUR) }, "course", NOW)).toEqual([]);
  });

  it("rejects a sale price that is zero, fractional, or not below the list price", () => {
    for (const salePriceCents of [0, -100, 10.5, 1500, 2000]) {
      expect(fields(validateSale({ ...plan, salePriceCents }, "course", NOW))).toEqual(["salePriceCents"]);
    }
  });

  it("rejects an end before the start, and an end in the past", () => {
    expect(
      fields(validateSale({ ...plan, saleStartsAt: after(2 * HOUR), saleEndsAt: after(HOUR) }, "course", NOW)),
    ).toEqual(["saleEndsAt"]);
    expect(fields(validateSale({ ...plan, saleEndsAt: NOW }, "course", NOW))).toEqual(["saleEndsAt"]);
  });

  it("allows a scheduled start in the future", () => {
    expect(validateSale({ ...plan, saleStartsAt: after(HOUR), saleEndsAt: after(48 * HOUR) }, "course", NOW)).toEqual([]);
  });

  it("requires a duration on plan sales and a valid period count", () => {
    expect(fields(validateSale(plan, "plan", NOW))).toEqual(["saleDuration"]);
    expect(fields(validateSale({ ...plan, saleDuration: "periods" }, "plan", NOW))).toEqual(["salePeriods"]);
    expect(
      fields(validateSale({ ...plan, saleDuration: "periods", salePeriods: MAX_SALE_PERIODS + 1 }, "plan", NOW)),
    ).toEqual(["salePeriods"]);
    expect(fields(validateSale({ ...plan, saleDuration: "forever", salePeriods: 2 }, "plan", NOW))).toEqual([
      "salePeriods",
    ]);
  });

  it("forbids a duration on course sales", () => {
    expect(fields(validateSale({ ...plan, saleDuration: "forever" }, "course", NOW))).toEqual(["saleDuration"]);
  });

  it("reports every problem at once", () => {
    expect(fields(validateSale({ ...plan, salePriceCents: 0, saleEndsAt: before(1) }, "plan", NOW))).toEqual([
      "salePriceCents",
      "saleEndsAt",
      "saleDuration",
    ]);
  });
});

describe("saleCouponSpec", () => {
  const base = {
    listPriceCents: 1500,
    salePriceCents: 900,
    currency: "USD",
    productId: "prod_1",
    saleEndsAt: null,
  };

  it("maps durations: course and 1 period → once, N periods → repeating months, forever", () => {
    expect(saleCouponSpec({ ...base, terms: null }).params).toEqual({
      name: "Sale",
      amount_off: 600,
      currency: "usd",
      duration: "once",
      applies_to: { products: ["prod_1"] },
    });
    expect(saleCouponSpec({ ...base, terms: { kind: "periods", periods: 1 }, periodMonths: 1 }).params.duration).toBe(
      "once",
    );
    expect(
      saleCouponSpec({ ...base, terms: { kind: "periods", periods: 3 }, periodMonths: 1 }).params,
    ).toMatchObject({ duration: "repeating", duration_in_months: 3 });
    expect(
      saleCouponSpec({ ...base, terms: { kind: "periods", periods: 2 }, periodMonths: 6 }).params,
    ).toMatchObject({ duration: "repeating", duration_in_months: 12 });
    expect(saleCouponSpec({ ...base, terms: { kind: "forever" } }).params.duration).toBe("forever");
  });

  it("sets redeem_by from the sale end", () => {
    const end = new Date("2026-12-01T00:00:00Z");
    expect(saleCouponSpec({ ...base, saleEndsAt: end, terms: null }).params.redeem_by).toBe(end.getTime() / 1000);
  });

  it("gives the same fingerprint for the same inputs and a new one when any input changes", () => {
    const a = saleCouponSpec({ ...base, terms: null }).fingerprint;
    expect(saleCouponSpec({ ...base, terms: null }).fingerprint).toBe(a);
    expect(saleCouponSpec({ ...base, salePriceCents: 800, terms: null }).fingerprint).not.toBe(a);
    expect(saleCouponSpec({ ...base, listPriceCents: 1600, terms: null }).fingerprint).not.toBe(a);
    expect(saleCouponSpec({ ...base, currency: "eur", terms: null }).fingerprint).not.toBe(a);
    expect(saleCouponSpec({ ...base, productId: "prod_2", terms: null }).fingerprint).not.toBe(a);
    expect(saleCouponSpec({ ...base, saleEndsAt: NOW, terms: null }).fingerprint).not.toBe(a);
  });

  it("refuses a multi-period plan sale without the cadence length", () => {
    expect(() => saleCouponSpec({ ...base, terms: { kind: "periods", periods: 3 } })).toThrow();
  });
});

describe("checkoutExpiresAt", () => {
  const sec = (d: Date) => Math.floor(d.getTime() / 1000);
  it("is unset when the sale has no end", () => {
    expect(checkoutExpiresAt(null, NOW)).toBeUndefined();
  });
  it("ends the session when the sale ends", () => {
    expect(checkoutExpiresAt(after(2 * HOUR), NOW)).toBe(sec(after(2 * HOUR)));
  });
  it("keeps Stripe's 30-minute floor and 24-hour ceiling", () => {
    expect(checkoutExpiresAt(after(10 * 60_000), NOW)).toBe(sec(after(31 * 60_000)));
    expect(checkoutExpiresAt(after(72 * HOUR), NOW)).toBe(sec(after(24 * HOUR)));
  });
});

describe("subscriber discount", () => {
  const start = new Date("2026-01-31T10:00:00Z");

  it("addMonthsUTC clamps to the end of shorter months", () => {
    expect(addMonthsUTC(start, 1).toISOString()).toBe("2026-02-28T10:00:00.000Z");
    expect(addMonthsUTC(start, 12).toISOString()).toBe("2027-01-31T10:00:00.000Z");
  });

  it("round-trips the metadata Checkout writes", () => {
    const onSale = effectivePlanPrice(cadence(), NOW);
    const metadata = saleSubscriptionMetadata(onSale);
    expect(metadata).toEqual({ discountCents: "600", discountPeriods: "3" });
    expect(subscriberDiscount({ hasStripeDiscount: true, metadata, start, periodMonths: 1 })).toEqual({
      discountCents: 600,
      discountEndsAt: addMonthsUTC(start, 3),
    });
  });

  it("forever has no end; no Stripe discount or unknown metadata means none", () => {
    const forever = { discountCents: "600", discountPeriods: "forever" };
    expect(subscriberDiscount({ hasStripeDiscount: true, metadata: forever, start, periodMonths: 1 })).toEqual({
      discountCents: 600,
      discountEndsAt: null,
    });
    const none = { discountCents: null, discountEndsAt: null };
    expect(subscriberDiscount({ hasStripeDiscount: false, metadata: forever, start, periodMonths: 1 })).toEqual(none);
    expect(subscriberDiscount({ hasStripeDiscount: true, metadata: {}, start, periodMonths: 1 })).toEqual(none);
    expect(
      subscriberDiscount({ hasStripeDiscount: true, metadata: { discountCents: "600", discountPeriods: "0" }, start, periodMonths: 1 }),
    ).toEqual(none);
  });

  it("writes no sale metadata when not on sale", () => {
    expect(saleSubscriptionMetadata(effectivePlanPrice(cadence({ salePriceCents: null }), NOW))).toEqual({});
  });
});
