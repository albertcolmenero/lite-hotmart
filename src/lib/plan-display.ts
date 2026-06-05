import { cadenceLabel, cadenceNote, cadenceMonths } from "./billing-cadences";

export type PlanPriceOption = {
  planPriceId: string;
  label: string; // "Every 6 months"
  note: string; // "every 6 months"
  shortCadence: string; // "/mo", "/6mo", "/yr"
  priceCents: number;
  months: number;
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
  }[];
};

export function shortCadence(interval: string, intervalCount: number): string {
  if (interval === "year") return intervalCount === 1 ? "/yr" : `/${intervalCount}yr`;
  return intervalCount === 1 ? "/mo" : `/${intervalCount}mo`;
}

/** Turn a Plan (with its PlanPrice rows) into the storefront display shape. */
export function toPlanDisplay(plan: PlanWithPrices | null | undefined): PlanDisplay | null {
  if (!plan) return null;
  const options = plan.prices
    .filter((p) => p.active && p.priceCents > 0)
    .map((p) => ({
      planPriceId: p.id,
      label: cadenceLabel(p.interval, p.intervalCount),
      note: cadenceNote(p.interval, p.intervalCount),
      shortCadence: shortCadence(p.interval, p.intervalCount),
      priceCents: p.priceCents,
      months: cadenceMonths(p.interval, p.intervalCount),
    }))
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
