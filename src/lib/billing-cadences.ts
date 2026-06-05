/**
 * Billing cadences a creator can offer. The data model (PlanPrice) is general —
 * any { interval, intervalCount } maps 1:1 to a Stripe Price recurring of
 * { interval, interval_count } — but the studio UI exposes this curated set so
 * the form stays simple. Add a row here to offer a new cadence everywhere.
 *
 * All amounts are in minor units (cents/centavos); every supported currency
 * (usd/eur/mxn) is 2-decimal, so the math is uniform.
 */
export type CadenceKey = "monthly" | "quarterly" | "semiannual" | "yearly";

export type Cadence = {
  key: CadenceKey;
  interval: "month" | "year"; // Stripe base interval
  intervalCount: number;
  label: string; // "Every 6 months"
  note: string; // price suffix, e.g. "every 6 months"
  months: number; // normalized months — for MRR
};

export const BILLING_CADENCES: Cadence[] = [
  { key: "monthly", interval: "month", intervalCount: 1, label: "Monthly", note: "per month", months: 1 },
  { key: "quarterly", interval: "month", intervalCount: 3, label: "Every 3 months", note: "every 3 months", months: 3 },
  { key: "semiannual", interval: "month", intervalCount: 6, label: "Every 6 months", note: "every 6 months", months: 6 },
  { key: "yearly", interval: "year", intervalCount: 1, label: "Yearly", note: "per year", months: 12 },
];

function find(interval: string, intervalCount: number): Cadence | undefined {
  return BILLING_CADENCES.find(
    (c) => c.interval === interval && c.intervalCount === intervalCount,
  );
}

/** Normalized number of months a cadence spans — used to normalize MRR. */
export function cadenceMonths(interval: string, intervalCount: number): number {
  return interval === "year" ? intervalCount * 12 : intervalCount;
}

/** Human label for a cadence, with a fallback for any custom interval. */
export function cadenceLabel(interval: string, intervalCount: number): string {
  const match = find(interval, intervalCount);
  if (match) return match.label;
  if (interval === "year") return intervalCount === 1 ? "Yearly" : `Every ${intervalCount} years`;
  return intervalCount === 1 ? "Monthly" : `Every ${intervalCount} months`;
}

/** Price-suffix note for a cadence, with a fallback for any custom interval. */
export function cadenceNote(interval: string, intervalCount: number): string {
  const match = find(interval, intervalCount);
  if (match) return match.note;
  if (interval === "year") return intervalCount === 1 ? "per year" : `every ${intervalCount} years`;
  return intervalCount === 1 ? "per month" : `every ${intervalCount} months`;
}
