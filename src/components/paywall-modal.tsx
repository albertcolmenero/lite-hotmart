"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, Sparkles, Smartphone, X } from "lucide-react";
import { formatCents } from "@/lib/utils";
import { type PlanDisplay, savingsVsMonthly } from "@/lib/plan-display";

export type PaywallProps = {
  open: boolean;
  onClose: () => void;
  creatorId: string;
  creatorName: string;
  creatorAccent: string;
  plan: PlanDisplay | null;
  signedIn: boolean;
};

export function PaywallModal({
  open,
  onClose,
  creatorId,
  creatorName,
  creatorAccent,
  plan,
  signedIn,
}: PaywallProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubscribe = (planPriceId: string) => {
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
        onClose();
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 paywall-root">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 paywall-backdrop"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="paywall-title"
        className="relative paywall-sheet card card-lift"
        style={{
          maxWidth: 440,
          width: "100%",
          background: "var(--paper)",
          borderRadius: "var(--radius-xl)",
          overflow: "hidden",
        }}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-md inline-flex items-center justify-center hover:bg-[color:var(--surface)] transition-colors"
          style={{ color: "var(--lichen)" }}
        >
          <X size={16} strokeWidth={2} />
        </button>

        <div className="px-7 pt-7 pb-6">
          <div
            className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium"
            style={{ background: `${creatorAccent}1A`, color: creatorAccent }}
          >
            <span
              aria-hidden
              className="inline-block w-1.5 h-1.5 rounded-full"
              style={{ background: creatorAccent }}
            />
            {creatorName} · Membership
          </div>

          <h2
            id="paywall-title"
            className="text-h2 mt-4"
            style={{ color: "var(--ink)" }}
          >
            Unlock the full studio.
          </h2>
          <p className="mt-2 text-sm" style={{ color: "var(--lichen)" }}>
            Subscribe to play this and everything else {creatorName} makes.
          </p>

          <ul className="mt-6 space-y-3">
            <Bullet
              accent={creatorAccent}
              icon={<Lock size={14} strokeWidth={2} />}
              title="Instant access"
              body="Every class and series, the moment you join."
            />
            <Bullet
              accent={creatorAccent}
              icon={<Sparkles size={14} strokeWidth={2} />}
              title="Reach your goals"
              body="Progress tracking and reward badges."
            />
            <Bullet
              accent={creatorAccent}
              icon={<Smartphone size={14} strokeWidth={2} />}
              title="Practice anywhere"
              body="Full access on every device."
            />
          </ul>

          {plan && plan.options.length > 0 ? (
            <div className="mt-6">
              <div className="text-label">Choose your plan</div>
              <div className="mt-2 space-y-2">
                {plan.options.map((opt, i) => {
                  const sv = savingsVsMonthly(plan.options, opt);
                  const featured = plan.options.length > 1 && i === plan.options.length - 1;
                  return (
                    <PlanButton
                      key={opt.planPriceId}
                      pending={pending}
                      label={opt.label}
                      sublabel={
                        sv ? `Save ${sv}%` : opt.months === 1 ? "Cancel anytime" : "Best value"
                      }
                      price={formatCents(opt.priceCents, plan.currency)}
                      cadence={opt.shortCadence}
                      onClick={() => handleSubscribe(opt.planPriceId)}
                      featured={featured}
                    />
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="mt-6 text-sm" style={{ color: "var(--lichen)" }}>
              This creator hasn&apos;t set up a plan yet.
            </p>
          )}

          {error ? (
            <p className="mt-3 text-sm" style={{ color: "var(--rust)" }}>{error}</p>
          ) : null}

          {!signedIn ? (
            <div
              className="mt-5 pt-4 text-center text-sm"
              style={{ borderTop: "1px solid var(--bone)" }}
            >
              <span style={{ color: "var(--lichen)" }}>Already a member? </span>
              <Link href="/sign-in" className="font-medium" style={{ color: "var(--ink)" }}>
                Sign in
              </Link>
            </div>
          ) : null}
        </div>
      </div>

      <style>{`
        .paywall-backdrop {
          background: rgba(10, 10, 11, 0.45);
          backdrop-filter: blur(6px);
          animation: paywall-fade var(--dur-base) var(--ease-out) both;
        }
        .paywall-sheet { animation: paywall-rise var(--dur-slow) var(--ease-spring) both; }
        @keyframes paywall-fade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes paywall-rise {
          from { opacity: 0; transform: translateY(20px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .paywall-backdrop, .paywall-sheet { animation: none; }
        }
      `}</style>
    </div>
  );
}

function Bullet({
  accent,
  icon,
  title,
  body,
}: {
  accent: string;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <li className="flex items-start gap-2.5">
      <div
        className="mt-0.5 w-7 h-7 rounded-md flex items-center justify-center shrink-0"
        style={{ background: `${accent}1A`, color: accent }}
      >
        {icon}
      </div>
      <div>
        <div className="font-medium text-sm" style={{ color: "var(--ink)" }}>{title}</div>
        <div className="text-sm mt-0.5" style={{ color: "var(--lichen)" }}>{body}</div>
      </div>
    </li>
  );
}

function PlanButton({
  pending,
  label,
  sublabel,
  price,
  cadence,
  onClick,
  featured,
}: {
  pending: boolean;
  label: string;
  sublabel: string;
  price: string;
  cadence: string;
  onClick: () => void;
  featured?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={pending}
      onClick={onClick}
      className="w-full text-left transition-all"
      style={{
        background: featured ? "var(--ink)" : "var(--paper)",
        color: featured ? "var(--paper)" : "var(--ink)",
        border: featured ? "1px solid var(--ink)" : "1px solid var(--bone)",
        borderRadius: "var(--radius-md)",
        padding: "0.9375rem 1.125rem",
        cursor: pending ? "wait" : "pointer",
        opacity: pending ? 0.6 : 1,
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-medium text-sm">{label}</div>
          <div
            className="text-xs mt-0.5"
            style={{ color: featured ? "var(--bone)" : "var(--lichen)" }}
          >
            {sublabel}
          </div>
        </div>
        <div className="text-right">
          <span
            style={{
              fontSize: "1.25rem",
              fontWeight: 600,
              letterSpacing: "-0.015em",
              lineHeight: 1,
            }}
          >
            {price}
          </span>
          <span
            className="text-xs ml-1"
            style={{ color: featured ? "var(--bone)" : "var(--lichen)" }}
          >
            {cadence}
          </span>
        </div>
      </div>
    </button>
  );
}
