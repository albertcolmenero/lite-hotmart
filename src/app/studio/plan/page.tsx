import { getCreatorForCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { FormCard, Field, ToggleRow } from "@/components/studio-form";
import { StripeStatusCard, getStripeStatus } from "@/components/stripe-status";
import { DEFAULT_CURRENCY } from "@/lib/currency";
import { BILLING_CADENCES } from "@/lib/billing-cadences";
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
  for (const pp of activePrices) {
    const cadence = BILLING_CADENCES.find(
      (c) => c.interval === pp.interval && c.intervalCount === pp.intervalCount,
    );
    if (cadence) priceDollars[cadence.key] = pp.priceCents / 100;
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
