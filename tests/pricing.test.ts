import { describe, expect, it } from "vitest";
import {
  MAX_SALE_PERIODS,
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
