"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatCents } from "@/lib/utils";
import { type PlanDisplay, savingsVsMonthly } from "@/lib/plan-display";

export type LandingPlanCardProps = {
  creatorId: string;
  creatorSlug: string;
  accentColor: string;
  plan: PlanDisplay;
  signedIn: boolean;
  /** When true the creator has connected Stripe (or bypass is in effect). When false,
   * paid prices render but the action buttons are disabled with a "coming soon" hint. */
  billingReady?: boolean;
};

export function LandingPlanCard({
  creatorId,
  creatorSlug,
  accentColor,
  plan,
  signedIn,
  billingReady = true,
}: LandingPlanCardProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const bestSavings = plan.options.reduce<number | null>((best, o) => {
    const s = savingsVsMonthly(plan.options, o);
    return s != null && (best == null || s > best) ? s : best;
  }, null);

  const handle = (planPriceId: string) => {
    if (!signedIn) {
      // Funnel to root sign-in (custom domains have no Clerk session), then
      // return to the storefront to finish subscribing.
      window.location.assign(`/sign-in?redirect_url=${encodeURIComponent(`/${creatorSlug}`)}`);
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ creatorId, planPriceId }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j?.error || "Subscribe failed");
        if (j?.redirectUrl) {
          window.location.href = j.redirectUrl;
          return;
        }
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  };

  return (
    <div className="card card-pop overflow-hidden">
      <div
        className="px-6 py-4 flex items-center justify-between"
        style={{
          borderBottom: "1px solid var(--bone)",
          background: "var(--surface)",
        }}
      >
        <div className="text-label">Choose your plan</div>
        {bestSavings != null ? (
          <span className="chip chip--accent">Save up to {bestSavings}%</span>
        ) : null}
      </div>

      <div className="p-5 space-y-2.5">
        {plan.options.map((opt, i) => {
          const sv = savingsVsMonthly(plan.options, opt);
          const featured = plan.options.length > 1 && i === plan.options.length - 1;
          return (
            <PlanRow
              key={opt.planPriceId}
              pending={pending}
              disabled={!billingReady}
              label={opt.label}
              sublabel={
                sv ? `${sv}% off vs monthly` : opt.months === 1 ? "Cancel anytime" : "Best value"
              }
              price={formatCents(opt.priceCents, plan.currency)}
              cadence={opt.note}
              onClick={() => handle(opt.planPriceId)}
              accent={featured ? accentColor : undefined}
              featured={featured}
            />
          );
        })}

        {!billingReady ? (
          <p
            className="text-sm text-center pt-1"
            style={{ color: "var(--lichen)" }}
          >
            Coming soon — this creator is finalizing billing.
          </p>
        ) : null}

        {error ? (
          <p className="text-sm" style={{ color: "var(--rust)" }}>{error}</p>
        ) : null}

        {!signedIn ? (
          <div
            className="text-center text-sm pt-4 mt-1"
            style={{ borderTop: "1px solid var(--bone)" }}
          >
            <span style={{ color: "var(--lichen)" }}>Already a member? </span>
            <Link
              href={`/sign-in?redirect_url=${encodeURIComponent(`/${creatorSlug}`)}`}
              className="font-medium"
              style={{ color: "var(--ink)" }}
            >
              Sign in
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PlanRow({
  pending,
  disabled,
  label,
  sublabel,
  price,
  cadence,
  onClick,
  accent,
  featured,
}: {
  pending: boolean;
  disabled?: boolean;
  label: string;
  sublabel: string;
  price: string;
  cadence: string;
  onClick: () => void;
  accent?: string;
  featured?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={pending || disabled}
      onClick={onClick}
      className="w-full text-left transition-all"
      style={{
        background: featured ? "var(--ink)" : "var(--paper)",
        color: featured ? "var(--paper)" : "var(--ink)",
        border: featured ? "1px solid var(--ink)" : "1px solid var(--bone)",
        borderRadius: "var(--radius-md)",
        padding: "1rem 1.125rem",
        cursor: disabled ? "not-allowed" : pending ? "wait" : "pointer",
        opacity: pending || disabled ? 0.55 : 1,
      }}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="font-medium" style={{ fontSize: "0.9375rem" }}>{label}</div>
          <div
            className="text-sm mt-0.5"
            style={{ color: featured ? "var(--bone)" : "var(--lichen)" }}
          >
            {sublabel}
          </div>
        </div>
        <div className="text-right">
          <div
            style={{
              fontSize: "1.5rem",
              fontWeight: 600,
              letterSpacing: "-0.02em",
              lineHeight: 1,
            }}
          >
            {price}
          </div>
          <div
            className="text-mono-sm mt-1"
            style={{ color: featured ? "var(--bone)" : "var(--lichen)" }}
          >
            {cadence}
          </div>
        </div>
      </div>
      {featured && accent ? (
        <div
          className="mt-3 flex items-center gap-1.5 text-xs font-medium"
        >
          <span
            className="inline-block w-1.5 h-1.5 rounded-full"
            style={{ background: accent }}
          />
          <span style={{ color: "var(--paper)" }}>Recommended</span>
        </div>
      ) : null}
    </button>
  );
}
