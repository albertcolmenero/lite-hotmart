import type { PlanPrice } from "@prisma/client";
import { getCreatorForCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { FormCard, Field, ToggleRow } from "@/components/studio-form";
import { StripeStatusCard, getStripeStatus } from "@/components/stripe-status";
import { DEFAULT_CURRENCY, currencySymbol } from "@/lib/currency";
import { BILLING_CADENCES, cadencePeriodNoun } from "@/lib/billing-cadences";
import { PLAN_SALE_WINDOW, planSaleFieldNames, saleFormDefaults } from "@/lib/sale-form";
import {
  SaleDurationInputs,
  SalePriceInput,
  SaleValidity,
  SaleWindowInputs,
} from "@/components/sale-fields";
import { PricingFields } from "./_pricing-fields";
import { upsertPlanAction } from "./actions";

export default async function PlanPage() {
  const creator = (await getCreatorForCurrentUser())!;
  const plan = await db.plan.findUnique({
    where: { creatorId: creator.id },
    include: { prices: true },
  });
  const status = getStripeStatus(creator);
  const activePrices = (plan?.prices ?? []).filter((pp) => pp.active && pp.priceCents > 0);
  const hasPaidPrice = activePrices.length > 0;
  // Fall back to USD so the page never hard-crashes if currency is missing
  // (e.g. before the Creator.currency column is pushed, or a stale client).
  const currency = creator.currency ?? DEFAULT_CURRENCY;
  const priceDollars: Record<string, number> = {};
  // Current or upcoming sales only: an ended sale shows as none, so saving clears it.
  const now = new Date();
  const saleDefaults: Record<string, PlanPrice> = {};
  let saleWindow: { startsAt: string | null; endsAt: string | null } | null = null;
  for (const pp of activePrices) {
    const cadence = BILLING_CADENCES.find(
      (c) => c.interval === pp.interval && c.intervalCount === pp.intervalCount,
    );
    if (!cadence) continue;
    priceDollars[cadence.key] = pp.priceCents / 100;
    const sale = saleFormDefaults(pp, now);
    if (sale) {
      saleDefaults[cadence.key] = sale;
      // All cadences on sale share one window (the form saves it to each).
      saleWindow ??= {
        startsAt: sale.saleStartsAt?.toISOString() ?? null,
        endsAt: sale.saleEndsAt?.toISOString() ?? null,
      };
    }
  }

  return (
    <div className="max-w-2xl space-y-7">
      <header>
        <h1 className="text-h1">Plan</h1>
        <p className="mt-1.5" style={{ color: "var(--lichen)" }}>
          Set a price for each billing cadence you want to offer. Subscribers get
          access to all your classes and series.
        </p>
      </header>

      <form action={upsertPlanAction} className="space-y-5">
        <FormCard title="Pricing" description="Offer any mix of cadences — leave a price blank to skip it.">
          <PricingFields defaultCurrency={currency} priceDollars={priceDollars} />

          {plan && hasPaidPrice && status === "connected" ? (
            <p className="text-sm" style={{ color: "var(--lichen)" }}>
              Existing subscribers keep their current price and currency. Changes apply only to new sign-ups.
            </p>
          ) : null}

          <Field label="Trial days" hint="0–90">
            <input
              name="trialDays"
              type="number"
              min={0}
              max={90}
              defaultValue={plan?.trialDays ?? 0}
              className="input input-mono"
              style={{ width: 120 }}
            />
          </Field>

          <ToggleRow
            name="active"
            defaultChecked={plan?.active ?? true}
            title="Plan is active"
            body="Shown to visitors. Turn off to hide from your storefront."
          />
        </FormCard>

        <FormCard
          title="Sale"
          description="Lower prices for a limited time. Your storefront shows the regular price crossed out."
        >
          <SaleWindowInputs
            startsName={PLAN_SALE_WINDOW.startsAt}
            endsName={PLAN_SALE_WINDOW.endsAt}
            defaultStartsAt={saleWindow?.startsAt ?? null}
            defaultEndsAt={saleWindow?.endsAt ?? null}
          />
          {BILLING_CADENCES.map((c) => {
            const names = planSaleFieldNames(c.key);
            const d = saleDefaults[c.key];
            return (
              <div key={c.key} className="pt-4 space-y-2" style={{ borderTop: "1px solid var(--bone)" }}>
                <Field label={`${c.label} sale price`} hint="Blank = no sale">
                  <div style={{ maxWidth: 220 }}>
                    <SalePriceInput
                      name={names.price}
                      symbol={currencySymbol(currency)}
                      defaultCents={d?.salePriceCents ?? null}
                    />
                  </div>
                </Field>
                <SaleDurationInputs
                  durationName={names.duration!}
                  periodsName={names.periods!}
                  periodNoun={cadencePeriodNoun(c)}
                  defaultDuration={d?.saleDuration ?? null}
                  defaultPeriods={d?.salePeriods ?? null}
                />
              </div>
            );
          })}
          <p className="text-sm" style={{ color: "var(--lichen)" }}>
            People who subscribe during the sale keep the sale price for as long as you choose
            above. Current subscribers aren&apos;t affected.
          </p>
          <SaleValidity
            configs={BILLING_CADENCES.map((c) => ({
              names: planSaleFieldNames(c.key),
              kind: "plan" as const,
              listPriceName: `price_${c.key}`,
            }))}
          />
        </FormCard>

        <FormCard title="Payouts" description="Connect Stripe to collect real subscription payments.">
          <StripeStatusCard creator={creator} showTitle={false} />
          {hasPaidPrice && status !== "connected" ? (
            <p className="mt-2 text-sm" style={{ color: "var(--amber)" }}>
              Heads up — your plan has prices set but Stripe isn&apos;t connected yet. Subscribe
              buttons are hidden on your storefront until you finish onboarding.
            </p>
          ) : null}
        </FormCard>

        <div className="flex items-center gap-4">
          <button type="submit" className="btn btn-primary">Save plan</button>
        </div>
      </form>
    </div>
  );
}
