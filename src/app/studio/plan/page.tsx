import { getCreatorForCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { FormCard, Field, ToggleRow } from "@/components/studio-form";
import { StripeStatusCard, getStripeStatus } from "@/components/stripe-status";
import { upsertPlanAction } from "./actions";

export default async function PlanPage() {
  const creator = (await getCreatorForCurrentUser())!;
  const plan = await db.plan.findUnique({ where: { creatorId: creator.id } });
  const status = getStripeStatus(creator);
  const hasPaidPrice = Boolean(plan?.monthlyPriceCents || plan?.yearlyPriceCents);

  return (
    <div className="max-w-2xl space-y-7">
      <header>
        <h1 className="text-h1">Plan</h1>
        <p className="mt-1.5" style={{ color: "var(--lichen)" }}>
          Set the monthly and yearly price. Subscribers get access to all your classes and series.
        </p>
      </header>

      <form action={upsertPlanAction} className="space-y-5">
        <FormCard title="Pricing" description="Leave either blank to disable that cadence.">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Monthly price" hint="USD">
              <div className="input flex items-baseline" style={{ padding: "0.5rem 0.75rem" }}>
                <span style={{ color: "var(--lichen)" }}>$</span>
                <input
                  name="monthlyDollars"
                  type="number"
                  step="0.01"
                  min={0}
                  defaultValue={plan?.monthlyPriceCents != null ? plan.monthlyPriceCents / 100 : ""}
                  className="flex-1 ml-1 bg-transparent outline-none tabular"
                  style={{ fontSize: "1.25rem", fontWeight: 600, color: "var(--ink)" }}
                />
              </div>
            </Field>
            <Field label="Yearly price" hint="USD">
              <div className="input flex items-baseline" style={{ padding: "0.5rem 0.75rem" }}>
                <span style={{ color: "var(--lichen)" }}>$</span>
                <input
                  name="yearlyDollars"
                  type="number"
                  step="0.01"
                  min={0}
                  defaultValue={plan?.yearlyPriceCents != null ? plan.yearlyPriceCents / 100 : ""}
                  className="flex-1 ml-1 bg-transparent outline-none tabular"
                  style={{ fontSize: "1.25rem", fontWeight: 600, color: "var(--ink)" }}
                />
              </div>
            </Field>
          </div>

          {plan && hasPaidPrice && status === "connected" ? (
            <p className="text-sm" style={{ color: "var(--lichen)" }}>
              Existing subscribers keep their current price. Changes apply only to new sign-ups.
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
