"use client";

import { useState } from "react";
import { Field } from "@/components/studio-form";
import { SUPPORTED_CURRENCIES, currencySymbol } from "@/lib/currency";

/**
 * Currency selector + price inputs. Client-side so the symbol ($/€/MX$) and the
 * USD/EUR/MXN hints update live as the creator changes the currency, before
 * they save. The inputs keep their `name`s so the parent server-action form
 * still submits them.
 */
export function PricingFields({
  defaultCurrency,
  monthlyCents,
  yearlyCents,
}: {
  defaultCurrency: string;
  monthlyCents: number | null;
  yearlyCents: number | null;
}) {
  const [currency, setCurrency] = useState(defaultCurrency);
  const sym = currencySymbol(currency);
  const cur = currency.toUpperCase();

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

      <div className="grid grid-cols-2 gap-4">
        <Field label="Monthly price" hint={cur}>
          <div className="input flex items-baseline" style={{ padding: "0.5rem 0.75rem" }}>
            <span style={{ color: "var(--lichen)" }}>{sym}</span>
            <input
              name="monthlyDollars"
              type="number"
              step="0.01"
              min={0}
              defaultValue={monthlyCents != null ? monthlyCents / 100 : ""}
              className="flex-1 ml-1 bg-transparent outline-none tabular"
              style={{ fontSize: "1.25rem", fontWeight: 600, color: "var(--ink)" }}
            />
          </div>
        </Field>
        <Field label="Yearly price" hint={cur}>
          <div className="input flex items-baseline" style={{ padding: "0.5rem 0.75rem" }}>
            <span style={{ color: "var(--lichen)" }}>{sym}</span>
            <input
              name="yearlyDollars"
              type="number"
              step="0.01"
              min={0}
              defaultValue={yearlyCents != null ? yearlyCents / 100 : ""}
              className="flex-1 ml-1 bg-transparent outline-none tabular"
              style={{ fontSize: "1.25rem", fontWeight: 600, color: "var(--ink)" }}
            />
          </div>
        </Field>
      </div>
    </>
  );
}
