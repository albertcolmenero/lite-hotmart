import { describe, expect, it } from "vitest";
import {
  coursePriceDisplay,
  saleTermsText,
  savingsVsMonthly,
  toPlanDisplay,
} from "@/lib/plan-display";

const NOW = new Date("2026-11-27T12:00:00Z");
const END = new Date("2026-12-02T05:59:00Z");

type Row = Parameters<typeof toPlanDisplay>[0] extends infer P
  ? P extends { prices: (infer R)[] }
    ? R
    : never
  : never;

const row = (o: Partial<Row>): Row => ({
  id: `pp_${o.interval ?? "month"}_${o.intervalCount ?? 1}`,
  interval: "month",
  intervalCount: 1,
  priceCents: 1500,
  active: true,
  salePriceCents: null,
  saleStartsAt: null,
  saleEndsAt: null,
  saleDuration: null,
  salePeriods: null,
  ...o,
});

const display = (...prices: Row[]) => toPlanDisplay({ currency: "usd", prices }, NOW)!;

describe("toPlanDisplay with sales", () => {
  it("shows the sale price, the regular price, the end and the terms", () => {
    const [opt] = display(
      row({ salePriceCents: 900, saleEndsAt: END, saleDuration: "periods", salePeriods: 3 }),
    ).options;
    expect(opt).toMatchObject({
      priceCents: 900,
      listPriceCents: 1500,
      saleEndsAt: END.toISOString(),
      saleTerms: { kind: "periods", periods: 3 },
    });
  });

  it("shows the regular price only, outside the window or without a sale", () => {
    const [ended] = display(
      row({ salePriceCents: 900, saleEndsAt: new Date("2026-11-01"), saleDuration: "forever" }),
    ).options;
    const [plain] = display(row({})).options;
    for (const o of [ended, plain]) {
      expect(o).toMatchObject({ priceCents: 1500, listPriceCents: null, saleEndsAt: null, saleTerms: null });
    }
  });

  it("compares savings on the prices people pay now", () => {
    const opts = display(
      row({ salePriceCents: 1000, saleDuration: "forever" }), // monthly on sale: 10/mo
      row({ interval: "year", intervalCount: 1, priceCents: 15000 }), // yearly: 150
    ).options;
    // 12 × 10 = 120 < 150, so the yearly option no longer saves anything.
    expect(savingsVsMonthly(opts, opts[1])).toBeNull();
  });
});

describe("saleTermsText", () => {
  const terms = (r: Partial<Row>) => saleTermsText(display(row(r)).options[0], "usd");

  it("says how long the sale price lasts and what comes after", () => {
    expect(terms({ salePriceCents: 900, saleDuration: "periods", salePeriods: 1 })).toBe(
      "for your first month, then $15.00/mo",
    );
    expect(terms({ salePriceCents: 900, saleDuration: "periods", salePeriods: 3 })).toBe(
      "for your first 3 months, then $15.00/mo",
    );
    expect(
      terms({ intervalCount: 3, priceCents: 4000, salePriceCents: 3000, saleDuration: "periods", salePeriods: 2 }),
    ).toBe("for your first 6 months, then $40.00/3mo");
    expect(
      terms({ interval: "year", priceCents: 15000, salePriceCents: 9900, saleDuration: "periods", salePeriods: 1 }),
    ).toBe("for your first year, then $150.00/yr");
    expect(
      terms({ intervalCount: 6, priceCents: 8000, salePriceCents: 6000, saleDuration: "periods", salePeriods: 4 }),
    ).toBe("for your first 2 years, then $80.00/6mo");
    expect(terms({ salePriceCents: 900, saleDuration: "forever" })).toBe(
      "and keep this price while you're subscribed",
    );
  });

  it("is null when not on sale", () => {
    expect(terms({})).toBeNull();
  });
});

describe("coursePriceDisplay", () => {
  const course = { priceCents: 5000, salePriceCents: 3000, saleStartsAt: null, saleEndsAt: END };
  it("shows the sale with its end while it runs", () => {
    expect(coursePriceDisplay(course, NOW)).toEqual({
      priceCents: 3000,
      listPriceCents: 5000,
      saleEndsAt: END.toISOString(),
    });
  });
  it("shows the regular price before a scheduled start", () => {
    expect(coursePriceDisplay({ ...course, saleStartsAt: new Date("2026-11-28") }, NOW)).toEqual({
      priceCents: 5000,
      listPriceCents: null,
      saleEndsAt: null,
    });
  });
});
