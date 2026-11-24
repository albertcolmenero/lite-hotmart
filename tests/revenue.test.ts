import { describe, expect, it } from "vitest";
import {
  mrrCents,
  mrrSeries,
  subscriptionMonthlyCents,
  subscriptionPeriodPrice,
  type RevenueSubscription,
} from "@/lib/revenue";

const NOW = new Date(2026, 10, 24, 12); // local time, like the studio pages
const day = (offset: number) => new Date(2026, 10, 24 + offset, 12);

const monthly = (o: Partial<RevenueSubscription> = {}): RevenueSubscription => ({
  interval: "month",
  discountCents: null,
  discountEndsAt: null,
  planPrice: { priceCents: 1500, interval: "month", intervalCount: 1 },
  plan: { monthlyPriceCents: null, yearlyPriceCents: null },
  ...o,
});

describe("subscriptionPeriodPrice", () => {
  it("is the regular price without a discount", () => {
    expect(subscriptionPeriodPrice(monthly(), NOW)).toEqual({
      cents: 1500,
      listCents: null,
      months: 1,
      shortCadence: "/mo",
    });
  });

  it("applies a discount until it ends, then the regular price", () => {
    const sub = monthly({ discountCents: 600, discountEndsAt: day(10) });
    expect(subscriptionPeriodPrice(sub, NOW)).toMatchObject({ cents: 900, listCents: 1500 });
    expect(subscriptionPeriodPrice(sub, day(10))).toMatchObject({ cents: 1500, listCents: null });
  });

  it("applies a forever discount with no end", () => {
    expect(subscriptionPeriodPrice(monthly({ discountCents: 600 }), day(1000))?.cents).toBe(900);
  });

  it("never goes below zero", () => {
    expect(subscriptionPeriodPrice(monthly({ discountCents: 5000 }), NOW)?.cents).toBe(0);
  });

  it("falls back to legacy plan prices for subscriptions from before PlanPrice", () => {
    const legacy = monthly({
      interval: "year",
      planPrice: null,
      plan: { monthlyPriceCents: 1500, yearlyPriceCents: 15000 },
    });
    expect(subscriptionPeriodPrice(legacy, NOW)).toMatchObject({ cents: 15000, months: 12, shortCadence: "/yr" });
    expect(subscriptionMonthlyCents(legacy, NOW)).toBe(1250);
    expect(subscriptionPeriodPrice(monthly({ planPrice: null }), NOW)).toBeNull();
  });
});

describe("MRR", () => {
  it("normalizes cadences to a month and counts discounts", () => {
    const yearly = monthly({
      interval: "year",
      planPrice: { priceCents: 12000, interval: "year", intervalCount: 1 },
    });
    const onSale = monthly({ discountCents: 600 });
    expect(mrrCents([monthly(), yearly, onSale], NOW)).toBe(1500 + 1000 + 900);
  });

  it("series counts a discount only while it applied, and skips ended subscriptions", () => {
    const start = day(-5);
    const sale = { ...monthly({ discountCents: 600, discountEndsAt: day(-2) }), startedAt: start, endedAt: null };
    const ended = { ...monthly(), startedAt: start, endedAt: day(-1) };
    const series = mrrSeries([sale, ended], 6, NOW);
    // Each day is evaluated at its midnight. Days -5..-2: the discount (ending
    // day -2 at noon) still applied → 900 + 1500. Day -1: the other sub ended
    // that day → only the sale sub, now at 1500. Day 0: 1500.
    expect(series).toEqual([2400, 2400, 2400, 2400, 1500, 1500]);
  });

  it("matches the previous behaviour when nothing is on sale", () => {
    const subs = [
      { ...monthly(), startedAt: day(-40), endedAt: null },
      { ...monthly(), startedAt: day(-3), endedAt: null },
    ];
    // Days -4..0; the second sub counts from its start day (-3).
    expect(mrrSeries(subs, 5, NOW)).toEqual([1500, 3000, 3000, 3000, 3000]);
  });
});
