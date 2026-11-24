/**
 * Reading a sale out of a studio form. Shared by the server actions (which
 * validate again and save) and by the browser (which validates as the creator
 * types), so both read the form the same way.
 *
 * Dates arrive as ISO strings in UTC: the browser converts the creator's local
 * date/time before submit (see components/sale-fields.tsx).
 */

import type { SaleDuration } from "@prisma/client";
import { validateSale, type SaleInput, type SaleValidationError } from "./pricing";

export type SaleFieldNames = {
  price: string;
  startsAt: string;
  endsAt: string;
  /** Plan cadences only. */
  duration?: string;
  periods?: string;
};

export type ParsedSale =
  | { kind: "none" }
  | { kind: "sale"; sale: Omit<SaleInput, "listPriceCents"> }
  | { kind: "invalid"; errors: SaleValidationError[] };

/** "12.50" → 1250. Blank → null. Anything else non-numeric → NaN (invalid). */
export function parseMoneyToCents(raw: FormDataEntryValue | null): number | null {
  if (raw == null || String(raw).trim() === "") return null;
  const n = Number(String(raw));
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}

function parseDate(raw: FormDataEntryValue | null): Date | null | "invalid" {
  if (raw == null || String(raw).trim() === "") return null;
  const d = new Date(String(raw));
  return Number.isNaN(d.getTime()) ? "invalid" : d;
}

/** A blank sale price means "no sale"; the other sale fields are then ignored. */
export function parseSaleForm(formData: FormData, names: SaleFieldNames): ParsedSale {
  const salePriceCents = parseMoneyToCents(formData.get(names.price));
  if (salePriceCents == null) return { kind: "none" };

  const errors: SaleValidationError[] = [];
  const startsAt = parseDate(formData.get(names.startsAt));
  const endsAt = parseDate(formData.get(names.endsAt));
  if (startsAt === "invalid") errors.push({ field: "saleStartsAt", message: "Enter a valid start date." });
  if (endsAt === "invalid") errors.push({ field: "saleEndsAt", message: "Enter a valid end date." });

  let saleDuration: SaleDuration | null = null;
  let salePeriods: number | null = null;
  if (names.duration) {
    const d = String(formData.get(names.duration) ?? "");
    saleDuration = d === "periods" || d === "forever" ? d : null;
    if (saleDuration === "periods" && names.periods) {
      const raw = String(formData.get(names.periods) ?? "").trim();
      salePeriods = raw === "" ? null : Number(raw);
    }
  }
  if (errors.length) return { kind: "invalid", errors };

  return {
    kind: "sale",
    sale: {
      salePriceCents,
      saleStartsAt: startsAt as Date | null,
      saleEndsAt: endsAt as Date | null,
      ...(names.duration ? { saleDuration, salePeriods } : {}),
    },
  };
}

/** Every problem with the sale in a form, given the regular price it discounts. */
export function saleFormErrors(
  parsed: ParsedSale,
  listPriceCents: number | null,
  kind: "plan" | "course",
  now: Date,
): SaleValidationError[] {
  if (parsed.kind === "none") return [];
  if (parsed.kind === "invalid") return parsed.errors;
  if (listPriceCents == null || Number.isNaN(listPriceCents)) {
    return [{ field: "salePriceCents", message: "Set a regular price before adding a sale." }];
  }
  return validateSale({ ...parsed.sale, listPriceCents }, kind, now);
}

export type SaleWriteData = {
  salePriceCents: number | null;
  saleStartsAt: Date | null;
  saleEndsAt: Date | null;
};

/**
 * Validate the sale in a form and return the columns to write. Throws when
 * invalid: the browser blocks those submits, so reaching here means a stale or
 * hand-made request. A blank sale price clears the sale. Coupon columns are
 * left alone; checkout replaces the coupon when the inputs change.
 */
export function readSaleForSave(
  formData: FormData,
  names: SaleFieldNames,
  kind: "course",
  listPriceCents: number,
  now: Date,
): SaleWriteData;
export function readSaleForSave(
  formData: FormData,
  names: SaleFieldNames,
  kind: "plan",
  listPriceCents: number,
  now: Date,
): SaleWriteData & { saleDuration: SaleDuration | null; salePeriods: number | null };
export function readSaleForSave(
  formData: FormData,
  names: SaleFieldNames,
  kind: "plan" | "course",
  listPriceCents: number,
  now: Date,
) {
  const parsed = parseSaleForm(formData, names);
  const errors = saleFormErrors(parsed, listPriceCents, kind, now);
  if (errors.length) throw new Error(`Invalid sale: ${errors.map((e) => e.message).join(" ")}`);

  const base: SaleWriteData =
    parsed.kind === "sale"
      ? {
          salePriceCents: parsed.sale.salePriceCents,
          saleStartsAt: parsed.sale.saleStartsAt,
          saleEndsAt: parsed.sale.saleEndsAt,
        }
      : { salePriceCents: null, saleStartsAt: null, saleEndsAt: null };
  if (kind === "course") return base;
  return {
    ...base,
    saleDuration: parsed.kind === "sale" ? (parsed.sale.saleDuration ?? null) : null,
    salePeriods: parsed.kind === "sale" ? (parsed.sale.salePeriods ?? null) : null,
  };
}

/**
 * The sale to show in a studio form: an ended sale is shown as no sale, so
 * saving the form clears it instead of failing on a past end date.
 */
export function saleFormDefaults<
  T extends { salePriceCents: number | null; saleEndsAt: Date | null },
>(item: T, now: Date): T | null {
  if (item.salePriceCents == null) return null;
  if (item.saleEndsAt && item.saleEndsAt <= now) return null;
  return item;
}

// ---------------------------------------------------------------- field names

/** The plan form has one sale window shared by every cadence on sale. */
export const PLAN_SALE_WINDOW = { startsAt: "sale_starts_at", endsAt: "sale_ends_at" } as const;

export function planSaleFieldNames(cadenceKey: string): SaleFieldNames {
  return {
    price: `sale_price_${cadenceKey}`,
    duration: `sale_duration_${cadenceKey}`,
    periods: `sale_periods_${cadenceKey}`,
    ...PLAN_SALE_WINDOW,
  };
}

export const COURSE_SALE_FIELDS: SaleFieldNames = {
  price: "salePrice",
  startsAt: "saleStartsAt",
  endsAt: "saleEndsAt",
};
