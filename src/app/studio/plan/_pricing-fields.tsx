"use client";

import { useState } from "react";
import { Field } from "@/components/studio-form";
import { SUPPORTED_CURRENCIES, currencySymbol } from "@/lib/currency";
import { BILLING_CADENCES } from "@/lib/billing-cadences";

/**
 * Currency selector + one price input per billing cadence. Client-side so the
 * currency symbol updates live. Each cadence input is named `price_<key>`; the
 * server action turns the filled ones into PlanPrice rows (blank = not offered).
 */
export function PricingFields({
  defaultCurrency,
  priceDollars,
}: {
  defaultCurrency: string;
  /** cadence key → dollars, for prefilling existing prices */
  priceDollars: Partial<Record<string, number>>;
}) {
  const [currency, setCurrency] = useState(defaultCurrency);
  const sym = currencySymbol(currency);

  return (
    <>
      <Field label="Currency" hint="Applies to your plan and all courses">
        <select
          name="currency"
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          className="select"
          style={{ maxWidth: 260 }}
        >
          {SUPPORTED_CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.label} ({c.symbol})
            </option>
          ))}
        </select>
      </Field>

      <div className="space-y-3">
        <div className="text-xs" style={{ color: "var(--lichen)" }}>
          Set a price for each billing cadence you want to offer. Leave blank to
          skip it.
        </div>
        {BILLING_CADENCES.map((c) => (
          <Field key={c.key} label={c.label} hint={c.note}>
            <div className="input flex items-baseline" style={{ padding: "0.5rem 0.75rem" }}>
              <span style={{ color: "var(--lichen)" }}>{sym}</span>
              <input
                name={`price_${c.key}`}
                type="number"
                step="0.01"
                min={0}
                defaultValue={priceDollars[c.key] ?? ""}
                className="flex-1 ml-1 bg-transparent outline-none tabular"
                style={{ fontSize: "1.125rem", fontWeight: 600, color: "var(--ink)" }}
              />
            </div>
          </Field>
        ))}
      </div>
    </>
  );
}
