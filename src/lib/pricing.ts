/**
 * Sale-price rules: the one place that decides what a plan cadence or course
 * costs right now, and whether a creator's sale settings are valid.
 *
 * Pure (no DB, no Stripe, no clock): callers pass `now`. Storefront display,
 * studio forms, and Checkout all call these, so the price a buyer sees is the
 * price they're charged.
 *
 * A sale is active on the half-open window [saleStartsAt, saleEndsAt); either
 * bound may be null (starts immediately / never ends). Anything inconsistent
 * at read time (sale not below list price, plan sale without a duration) fails
 * closed: no sale is shown and the list price is charged.
 */

import type { SaleDuration } from "@prisma/client";

export type SaleFields = {
  priceCents: number;
  salePriceCents: number | null;
  saleStartsAt: Date | null;
  saleEndsAt: Date | null;
};

export type PlanSaleFields = SaleFields & {
  saleDuration: SaleDuration | null;
  salePeriods: number | null;
};

/** How long a subscriber keeps the sale price after subscribing. */
export type SaleTerms = { kind: "forever" } | { kind: "periods"; periods: number };

export type EffectivePrice = {
  /** What the buyer pays now. */
  priceCents: number;
  /** The regular price, set only while a sale is active (for strike-through). */
  listPriceCents: number | null;
  onSale: boolean;
  saleEndsAt: Date | null;
};

export type PlanEffectivePrice = EffectivePrice & { terms: SaleTerms | null };

export const MAX_SALE_PERIODS = 24;

function inWindow(item: SaleFields, now: Date): boolean {
  if (item.saleStartsAt && now < item.saleStartsAt) return false;
  if (item.saleEndsAt && now >= item.saleEndsAt) return false;
  return true;
}

function hasValidSaleAmount(item: SaleFields): item is SaleFields & { salePriceCents: number } {
  return (
    item.salePriceCents != null &&
    Number.isInteger(item.salePriceCents) &&
    item.salePriceCents > 0 &&
    item.salePriceCents < item.priceCents
  );
}

/** The sale terms stored on a plan cadence, or null if they're unusable. */
export function saleTerms(item: Pick<PlanSaleFields, "saleDuration" | "salePeriods">): SaleTerms | null {
  if (item.saleDuration === "forever") return { kind: "forever" };
  if (
    item.saleDuration === "periods" &&
    item.salePeriods != null &&
    Number.isInteger(item.salePeriods) &&
    item.salePeriods >= 1 &&
    item.salePeriods <= MAX_SALE_PERIODS
  ) {
    return { kind: "periods", periods: item.salePeriods };
  }
  return null;
}

const NO_SALE = (priceCents: number): EffectivePrice => ({
  priceCents,
  listPriceCents: null,
  onSale: false,
  saleEndsAt: null,
});

/** Current price of a one-time item (course). */
export function effectivePrice(item: SaleFields, now: Date): EffectivePrice {
  if (!hasValidSaleAmount(item) || !inWindow(item, now)) return NO_SALE(item.priceCents);
  return {
    priceCents: item.salePriceCents,
    listPriceCents: item.priceCents,
    onSale: true,
    saleEndsAt: item.saleEndsAt,
  };
}

/** Current price of a plan cadence, including how long the sale price lasts. */
export function effectivePlanPrice(item: PlanSaleFields, now: Date): PlanEffectivePrice {
  const terms = saleTerms(item);
  const base = effectivePrice(item, now);
  if (!base.onSale || !terms) return { ...NO_SALE(item.priceCents), terms: null };
  return { ...base, terms };
}

// ---------------------------------------------------------------- validation

export type SaleInput = {
  listPriceCents: number;
  salePriceCents: number;
  saleStartsAt: Date | null;
  saleEndsAt: Date | null;
  /** Plan cadences only; must be omitted/null for courses. */
  saleDuration?: SaleDuration | null;
  salePeriods?: number | null;
};

export type SaleField = "salePriceCents" | "saleStartsAt" | "saleEndsAt" | "saleDuration" | "salePeriods";
export type SaleValidationError = { field: SaleField; message: string };

/**
 * Validate a sale a creator is saving. `kind` decides whether a duration is
 * required (plan) or forbidden (course). Returns every problem, not the first.
 */
export function validateSale(
  input: SaleInput,
  kind: "plan" | "course",
  now: Date,
): SaleValidationError[] {
  const errors: SaleValidationError[] = [];

  if (!Number.isInteger(input.salePriceCents) || input.salePriceCents <= 0) {
    errors.push({ field: "salePriceCents", message: "Sale price must be more than 0." });
  } else if (input.salePriceCents >= input.listPriceCents) {
    errors.push({ field: "salePriceCents", message: "Sale price must be lower than the regular price." });
  }

  if (input.saleStartsAt && input.saleEndsAt && input.saleEndsAt <= input.saleStartsAt) {
    errors.push({ field: "saleEndsAt", message: "Sale must end after it starts." });
  } else if (input.saleEndsAt && input.saleEndsAt <= now) {
    errors.push({ field: "saleEndsAt", message: "Sale end must be in the future." });
  }

  if (kind === "course") {
    if (input.saleDuration != null || input.salePeriods != null) {
      errors.push({ field: "saleDuration", message: "Courses are one-time purchases; no sale duration." });
    }
    return errors;
  }

  if (input.saleDuration == null) {
    errors.push({ field: "saleDuration", message: "Choose how long subscribers keep the sale price." });
  } else if (input.saleDuration === "periods") {
    const n = input.salePeriods;
    if (n == null || !Number.isInteger(n) || n < 1 || n > MAX_SALE_PERIODS) {
      errors.push({
        field: "salePeriods",
        message: `Number of billing periods must be between 1 and ${MAX_SALE_PERIODS}.`,
      });
    }
  } else if (input.salePeriods != null) {
    errors.push({ field: "salePeriods", message: "A forever sale has no number of periods." });
  }

  return errors;
}

// ---------------------------------------------------------------- Stripe coupon

/**
 * The Stripe coupon that turns the regular Price into the sale price, plus a
 * fingerprint of its inputs. The coupon is recreated whenever the fingerprint
 * changes (Stripe coupons are immutable).
 *
 * Duration: one-time items and "1 billing period" use `once`; N periods use
 * `repeating` for N × months-per-period; `forever` stays forever.
 */
export type SaleCouponSpec = {
  params: {
    name: string;
    amount_off: number;
    currency: string;
    duration: "once" | "repeating" | "forever";
    duration_in_months?: number;
    redeem_by?: number;
    applies_to: { products: string[] };
  };
  fingerprint: string;
};

export function saleCouponSpec(input: {
  listPriceCents: number;
  salePriceCents: number;
  currency: string;
  productId: string;
  saleEndsAt: Date | null;
  /** null for one-time items (courses). */
  terms: SaleTerms | null;
  /** Months per billing period of the cadence (plans only). */
  periodMonths?: number;
}): SaleCouponSpec {
  let duration: SaleCouponSpec["params"]["duration"] = "once";
  let durationInMonths: number | undefined;
  if (input.terms?.kind === "forever") duration = "forever";
  else if (input.terms?.kind === "periods" && input.terms.periods > 1) {
    if (!input.periodMonths || input.periodMonths < 1) {
      throw new Error("periodMonths is required for a multi-period plan sale");
    }
    duration = "repeating";
    durationInMonths = input.terms.periods * input.periodMonths;
  }

  // Built in a fixed key order so the fingerprint is stable.
  const params: SaleCouponSpec["params"] = {
    name: "Sale",
    amount_off: input.listPriceCents - input.salePriceCents,
    currency: input.currency.toLowerCase(),
    duration,
    ...(durationInMonths ? { duration_in_months: durationInMonths } : {}),
    ...(input.saleEndsAt ? { redeem_by: Math.floor(input.saleEndsAt.getTime() / 1000) } : {}),
    applies_to: { products: [input.productId] },
  };
  return { params, fingerprint: JSON.stringify(params) };
}

/** Stripe allows a Checkout Session to live 30 minutes to 24 hours. */
const CHECKOUT_MIN_MS = 31 * 60_000; // 1 minute margin over Stripe's floor
const CHECKOUT_MAX_MS = 24 * 3_600_000;

/**
 * `expires_at` (epoch seconds) for a Checkout Session during a sale that ends,
 * so a page opened during the sale can't be paid at the sale price much later.
 * Undefined when there's nothing to bound (no sale, or no end date). If the
 * sale ends in under 31 minutes, the session still lives 31 minutes: Stripe's
 * minimum sets that grace.
 */
export function checkoutExpiresAt(saleEndsAt: Date | null, now: Date): number | undefined {
  if (!saleEndsAt) return undefined;
  const ms = Math.min(
    now.getTime() + CHECKOUT_MAX_MS,
    Math.max(now.getTime() + CHECKOUT_MIN_MS, saleEndsAt.getTime()),
  );
  return Math.floor(ms / 1000);
}

// ---------------------------------------------------------------- subscriber discount

/** Metadata Checkout puts on a sale subscription so the webhook can record it. */
export function saleSubscriptionMetadata(
  price: PlanEffectivePrice,
): Record<string, string> {
  if (!price.onSale || !price.terms || price.listPriceCents == null) return {};
  return {
    discountCents: String(price.listPriceCents - price.priceCents),
    discountPeriods: price.terms.kind === "forever" ? "forever" : String(price.terms.periods),
  };
}

/** Add calendar months in UTC, clamping to the last day of a shorter month. */
export function addMonthsUTC(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

/**
 * The discount a subscriber pays under, from what Checkout recorded in the
 * subscription metadata. Anchored on Stripe's fixed `start` so replays agree.
 * No discount on the Stripe subscription (ended, or removed by the creator)
 * means none here; a discount we didn't create (no metadata) is unknown → none.
 */
export function subscriberDiscount(input: {
  hasStripeDiscount: boolean;
  metadata: Record<string, string> | null | undefined;
  start: Date;
  periodMonths: number;
}): { discountCents: number | null; discountEndsAt: Date | null } {
  const none = { discountCents: null, discountEndsAt: null };
  if (!input.hasStripeDiscount) return none;
  const cents = Number(input.metadata?.discountCents);
  if (!Number.isInteger(cents) || cents <= 0) return none;
  const periods = input.metadata?.discountPeriods;
  if (periods === "forever") return { discountCents: cents, discountEndsAt: null };
  const n = Number(periods);
  if (!Number.isInteger(n) || n < 1) return none;
  return { discountCents: cents, discountEndsAt: addMonthsUTC(input.start, n * input.periodMonths) };
}
