"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Field, MoneyInput } from "@/components/studio-form";
import { MAX_SALE_PERIODS } from "@/lib/pricing";
import {
  parseMoneyToCents,
  parseSaleForm,
  saleFormErrors,
  type SaleFieldNames,
} from "@/lib/sale-form";

/**
 * Studio sale inputs. The creator picks dates in their own time zone; hidden
 * inputs carry them to the server as UTC ISO strings. <SaleValidity> checks the
 * whole form with the same rules the server uses and blocks submit with the
 * browser's own field messages, so input is never lost to an error page.
 */

/** Date → "YYYY-MM-DDTHH:mm" in the browser's local time (datetime-local value). */
function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}`;
}

const noSubscribe = () => () => {};

/** A browser-only value: "" while server rendering and hydrating, then the real one. */
function useBrowserValue(read: () => string): string {
  return useSyncExternalStore(noSubscribe, read, () => "");
}

function LocalDateTimeInput({ name, defaultIso }: { name: string; defaultIso: string | null }) {
  // The server doesn't know the creator's time zone, so the local value only
  // exists in the browser; `key` remounts the input once it's known.
  const initialLocal = useBrowserValue(() => (defaultIso ? toLocalInputValue(defaultIso) : ""));
  const [iso, setIso] = useState(defaultIso ?? "");

  return (
    <>
      <input
        key={initialLocal}
        type="datetime-local"
        data-sale-for={name}
        defaultValue={initialLocal}
        onChange={(e) => {
          const d = e.target.value ? new Date(e.target.value) : null;
          setIso(d && !Number.isNaN(d.getTime()) ? d.toISOString() : "");
        }}
        className="input"
      />
      <input type="hidden" name={name} value={iso} />
    </>
  );
}

function useTimeZone(): string {
  return useBrowserValue(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
}

/** Start and end of a sale. Both optional: no start = now, no end = until removed. */
export function SaleWindowInputs({
  startsName,
  endsName,
  defaultStartsAt,
  defaultEndsAt,
}: {
  startsName: string;
  endsName: string;
  defaultStartsAt: string | null;
  defaultEndsAt: string | null;
}) {
  const tz = useTimeZone();
  return (
    <div className="space-y-1.5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Sale starts" hint="Blank = right away">
          <LocalDateTimeInput name={startsName} defaultIso={defaultStartsAt} />
        </Field>
        <Field label="Sale ends" hint="Blank = until you remove it">
          <LocalDateTimeInput name={endsName} defaultIso={defaultEndsAt} />
        </Field>
      </div>
      {tz ? (
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          Times are in your time zone ({tz}).
        </p>
      ) : null}
    </div>
  );
}

/** How long a subscriber keeps the sale price. */
export function SaleDurationInputs({
  durationName,
  periodsName,
  periodNoun,
  defaultDuration,
  defaultPeriods,
}: {
  durationName: string;
  periodsName: string;
  /** e.g. "months", "years", "6-month periods" */
  periodNoun: string;
  defaultDuration: "periods" | "forever" | null;
  defaultPeriods: number | null;
}) {
  const [duration, setDuration] = useState(defaultDuration ?? "periods");
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        name={durationName}
        value={duration}
        onChange={(e) => setDuration(e.target.value as "periods" | "forever")}
        className="select"
        style={{ maxWidth: 200 }}
      >
        <option value="periods">For the first</option>
        <option value="forever">Forever</option>
      </select>
      {duration === "periods" ? (
        <>
          <input
            name={periodsName}
            type="number"
            min={1}
            max={MAX_SALE_PERIODS}
            step={1}
            defaultValue={defaultPeriods ?? 1}
            className="input input-mono"
            style={{ width: 80 }}
          />
          <span className="text-sm" style={{ color: "var(--lichen)" }}>
            {periodNoun}, then the regular price
          </span>
        </>
      ) : (
        <span className="text-sm" style={{ color: "var(--lichen)" }}>
          Subscribers keep this price
        </span>
      )}
    </div>
  );
}

/** Sale price input (blank = no sale). */
export function SalePriceInput({
  name,
  symbol,
  defaultCents,
}: {
  name: string;
  symbol: string;
  defaultCents: number | null;
}) {
  return (
    <MoneyInput
      name={name}
      symbol={symbol}
      defaultValue={defaultCents != null ? defaultCents / 100 : undefined}
      placeholder="No sale"
    />
  );
}

export type SaleValidityConfig = {
  names: SaleFieldNames;
  kind: "plan" | "course";
  /** Name of the form input holding the regular price. */
  listPriceName: string;
};

/**
 * Re-checks every sale on the surrounding form whenever it changes, and puts
 * each problem on the input it's about via setCustomValidity.
 */
export function SaleValidity({ configs }: { configs: SaleValidityConfig[] }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;

    const inputFor = (names: SaleFieldNames, field: string): HTMLInputElement | HTMLSelectElement | null => {
      const byName = (n?: string) =>
        n ? form.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${n}"]`) : null;
      if (field === "saleStartsAt") return form.querySelector(`[data-sale-for="${names.startsAt}"]`);
      if (field === "saleEndsAt") return form.querySelector(`[data-sale-for="${names.endsAt}"]`);
      if (field === "saleDuration") return byName(names.duration);
      if (field === "salePeriods") return byName(names.periods) ?? byName(names.duration);
      return byName(names.price);
    };

    const check = () => {
      const fd = new FormData(form);
      const now = new Date();
      const messages = new Map<HTMLInputElement | HTMLSelectElement, string[]>();
      for (const c of configs) {
        for (const field of ["salePriceCents", "saleStartsAt", "saleEndsAt", "saleDuration", "salePeriods"]) {
          const el = inputFor(c.names, field);
          if (el && !messages.has(el)) messages.set(el, []);
        }
        const errors = saleFormErrors(
          parseSaleForm(fd, c.names),
          parseMoneyToCents(fd.get(c.listPriceName)),
          c.kind,
          now,
        );
        for (const e of errors) {
          const el = inputFor(c.names, e.field);
          if (el && !messages.get(el)!.includes(e.message)) messages.get(el)!.push(e.message);
        }
      }
      for (const [el, msgs] of messages) el.setCustomValidity(msgs.join(" "));
    };

    // React updates the hidden date inputs after this listener runs; check on
    // the next tick so FormData sees the new values.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(check, 0);
    };
    // An end date that passes while the page is open isn't caught here; the
    // server action rejects it.
    form.addEventListener("input", schedule);
    form.addEventListener("change", schedule);
    schedule();
    return () => {
      clearTimeout(timer);
      form.removeEventListener("input", schedule);
      form.removeEventListener("change", schedule);
    };
  }, [configs]);

  return <span ref={ref} hidden />;
}
