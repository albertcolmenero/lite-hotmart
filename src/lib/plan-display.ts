import type { SaleDuration } from "@prisma/client";
import { cadenceLabel, cadenceNote, cadenceMonths } from "./billing-cadences";
import { effectivePlanPrice, effectivePrice, type SaleTerms } from "./pricing";
import { formatCents } from "./utils";

export type PlanPriceOption = {
  planPriceId: string;
  label: string; // "Every 6 months"
  note: string; // "every 6 months"
  shortCadence: string; // "/mo", "/6mo", "/yr"
  /** What a new subscriber pays now (the sale price during a sale). */
  priceCents: number;
  months: number;
  /** Regular price while on sale (show it crossed out); null otherwise. */
  listPriceCents: number | null;
  /** ISO end of the sale, if it has one. */
  saleEndsAt: string | null;
  saleTerms: SaleTerms | null;
};

export type PlanDisplay = {
  currency: string;
  options: PlanPriceOption[]; // active, priced, sorted by span ascending
};

type PlanWithPrices = {
  currency: string;
  prices: {
    id: string;
    interval: string;
    intervalCount: number;
    priceCents: number;
    active: boolean;
    salePriceCents: number | null;
    saleStartsAt: Date | null;
    saleEndsAt: Date | null;
    saleDuration: SaleDuration | null;
    salePeriods: number | null;
  }[];
};

export function shortCadence(interval: string, intervalCount: number): string {
  if (interval === "year") return intervalCount === 1 ? "/yr" : `/${intervalCount}yr`;
  return intervalCount === 1 ? "/mo" : `/${intervalCount}mo`;
}

/**
 * Turn a Plan (with its PlanPrice rows) into the storefront display shape.
 * Prices are as of `now` (render time), using the same rules as Checkout.
 */
export function toPlanDisplay(
  plan: PlanWithPrices | null | undefined,
  now: Date = new Date(),
): PlanDisplay | null {
  if (!plan) return null;
  const options = plan.prices
    .filter((p) => p.active && p.priceCents > 0)
    .map((p) => {
      const price = effectivePlanPrice(p, now);
      return {
        planPriceId: p.id,
        label: cadenceLabel(p.interval, p.intervalCount),
        note: cadenceNote(p.interval, p.intervalCount),
        shortCadence: shortCadence(p.interval, p.intervalCount),
        priceCents: price.priceCents,
        months: cadenceMonths(p.interval, p.intervalCount),
        listPriceCents: price.listPriceCents,
        saleEndsAt: price.saleEndsAt?.toISOString() ?? null,
        saleTerms: price.terms,
      };
    })
    .sort((a, b) => a.months - b.months);
  return { currency: plan.currency, options };
}

/** Savings % of a longer option vs paying the monthly option for the same span. */
export function savingsVsMonthly(
  options: PlanPriceOption[],
  opt: PlanPriceOption,
): number | null {
  const monthly = options.find((o) => o.months === 1);
  if (!monthly || opt.months <= 1) return null;
  const ifMonthly = monthly.priceCents * opt.months;
  if (ifMonthly <= 0) return null;
  const pct = Math.round(((ifMonthly - opt.priceCents) / ifMonthly) * 100);
  return pct > 0 ? pct : null;
}

/** "first month", "first 3 months", "first year", "first 2 years". */
function firstSpan(totalMonths: number): string {
  if (totalMonths % 12 === 0) {
    const years = totalMonths / 12;
    return years === 1 ? "first year" : `first ${years} years`;
  }
  return totalMonths === 1 ? "first month" : `first ${totalMonths} months`;
}

/**
 * What a sale means for a subscriber, e.g. "for your first 3 months, then
 * $15.00/mo" or "and keep this price while you're subscribed". Null when the
 * option isn't on sale. Buyers must see the price they'll pay afterwards.
 */
export function saleTermsText(opt: PlanPriceOption, currency: string): string | null {
  if (!opt.saleTerms || opt.listPriceCents == null) return null;
  if (opt.saleTerms.kind === "forever") return "and keep this price while you're subscribed";
  return `for your ${firstSpan(opt.saleTerms.periods * opt.months)}, then ${formatCents(
    opt.listPriceCents,
    currency,
  )}${opt.shortCadence}`;
}

export type CoursePriceDisplay = {
  /** What a buyer pays now. */
  priceCents: number;
  /** Regular price while on sale; null otherwise. */
  listPriceCents: number | null;
  saleEndsAt: string | null;
};

/** A course's storefront price as of `now`, using the same rules as Checkout. */
export function coursePriceDisplay(
  course: {
    priceCents: number;
    salePriceCents: number | null;
    saleStartsAt: Date | null;
    saleEndsAt: Date | null;
  },
  now: Date = new Date(),
): CoursePriceDisplay {
  const price = effectivePrice(course, now);
  return {
    priceCents: price.priceCents,
    listPriceCents: price.listPriceCents,
    saleEndsAt: price.saleEndsAt?.toISOString() ?? null,
  };
}
