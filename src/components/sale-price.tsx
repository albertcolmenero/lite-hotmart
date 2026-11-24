"use client";

import { useSyncExternalStore } from "react";
import { formatCents } from "@/lib/utils";

/**
 * Storefront price with an optional sale: the regular price crossed out before
 * the price paid now. Typography is inherited, so it fits each price slot.
 */
export function SalePrice({
  priceCents,
  listPriceCents,
  currency,
}: {
  priceCents: number;
  listPriceCents: number | null;
  currency: string;
}) {
  if (listPriceCents == null) return <>{formatCents(priceCents, currency)}</>;
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <s style={{ opacity: 0.5, fontWeight: 400, fontSize: "0.7em" }} aria-label={`Regular price ${formatCents(listPriceCents, currency)}`}>
        {formatCents(listPriceCents, currency)}
      </s>
      <span>{formatCents(priceCents, currency)}</span>
    </span>
  );
}

const noSubscribe = () => () => {};

/**
 * "Sale ends Dec 1, 11:59 PM" in the visitor's own time zone. Renders nothing
 * on the server (which doesn't know that zone) and fills in after hydration.
 */
export function SaleEndsNote({ iso, prefix = "Sale ends" }: { iso: string | null; prefix?: string }) {
  const text = useSyncExternalStore(
    noSubscribe,
    () =>
      iso
        ? new Intl.DateTimeFormat(undefined, {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          }).format(new Date(iso))
        : "",
    () => "",
  );
  if (!iso || !text) return null;
  return (
    <>
      {prefix} {text}
    </>
  );
}
