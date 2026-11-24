/**
 * Subscription revenue: what a subscriber pays and the creator's MRR. One
 * implementation for the studio dashboard, analytics and subscribers pages.
 *
 * A sale discount (Subscription.discountCents, recorded from Stripe) applies
 * until discountEndsAt, or for good when that is null. Pure: callers pass the
 * moment to evaluate at.
 *
 * Known limit: a subscriber grandfathered on an old price is counted at the
 * cadence's current price (we don't store the old amount locally).
 */

import { cadenceMonths } from "./billing-cadences";
import { shortCadence } from "./plan-display";

export type RevenueSubscription = {
  interval: string;
  discountCents: number | null;
  discountEndsAt: Date | null;
  planPrice: { priceCents: number; interval: string; intervalCount: number } | null;
  /** Legacy two-cadence prices, for subscriptions from before PlanPrice. */
  plan: { monthlyPriceCents: number | null; yearlyPriceCents: number | null };
};

export type PeriodPrice = {
  /** Paid per billing period at the given moment. */
  cents: number;
  /** Regular price while a discount applies; null otherwise. */
  listCents: number | null;
  months: number;
  shortCadence: string;
};

function discountApplies(sub: RevenueSubscription, at: Date): boolean {
  return (
    sub.discountCents != null &&
    sub.discountCents > 0 &&
    (sub.discountEndsAt == null || at < sub.discountEndsAt)
  );
}

/** What the subscriber pays per billing period at `at`; null when unknown. */
export function subscriptionPeriodPrice(sub: RevenueSubscription, at: Date): PeriodPrice | null {
  const pp = sub.planPrice;
  if (pp) {
    const discounted = discountApplies(sub, at);
    return {
      cents: discounted ? Math.max(0, pp.priceCents - sub.discountCents!) : pp.priceCents,
      listCents: discounted ? pp.priceCents : null,
      months: cadenceMonths(pp.interval, pp.intervalCount),
      shortCadence: shortCadence(pp.interval, pp.intervalCount),
    };
  }
  if (sub.interval === "year" && sub.plan.yearlyPriceCents) {
    return { cents: sub.plan.yearlyPriceCents, listCents: null, months: 12, shortCadence: "/yr" };
  }
  if (sub.interval === "month" && sub.plan.monthlyPriceCents) {
    return { cents: sub.plan.monthlyPriceCents, listCents: null, months: 1, shortCadence: "/mo" };
  }
  return null;
}

/** The subscriber's contribution to MRR at `at` (unrounded cents per month). */
export function subscriptionMonthlyCents(sub: RevenueSubscription, at: Date): number {
  const p = subscriptionPeriodPrice(sub, at);
  return p ? p.cents / p.months : 0;
}

/** Sum of monthly contributions, rounded to whole cents. */
export function mrrCents(subs: RevenueSubscription[], at: Date): number {
  return Math.round(subs.reduce((acc, s) => acc + subscriptionMonthlyCents(s, at), 0));
}

function dayStart(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * Daily MRR for the last `days` days ending `today`, oldest first. A
 * subscription counts on a day if it started on or before it and hadn't ended;
 * a discount counts while it applied at the start of that day.
 */
export function mrrSeries(
  subs: (RevenueSubscription & { startedAt: Date; endedAt: Date | null })[],
  days: number,
  today: Date,
): number[] {
  const end = dayStart(today);
  const series: number[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(d.getDate() - i);
    const live = subs.filter((s) => {
      const started = dayStart(s.startedAt) <= d;
      const ended = s.endedAt ? dayStart(s.endedAt) <= d : false;
      return started && !ended;
    });
    series.push(mrrCents(live, d));
  }
  return series;
}
