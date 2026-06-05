"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PaywallModal } from "@/components/paywall-modal";
import type { PlanDisplay } from "@/lib/plan-display";
import { formatCents } from "@/lib/utils";

export function BuyCourseButton({
  courseId,
  priceCents,
  currency,
  subscribed,
  signedIn,
  creator,
  plan,
}: {
  courseId: string;
  priceCents: number;
  currency: string;
  subscribed: boolean;
  signedIn: boolean;
  creator: { id: string; displayName: string; accentColor: string };
  plan: PlanDisplay | null;
}) {
  const router = useRouter();
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onClick = () => {
    if (!signedIn || !subscribed) {
      setPaywallOpen(true);
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/purchase", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ courseId }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j?.error || "Purchase failed");
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

  const priceLabel = formatCents(priceCents, currency);

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className={`btn btn-lg w-full ${subscribed ? "btn-primary" : "btn-secondary"}`}
        style={{ opacity: pending ? 0.6 : 1 }}
      >
        {subscribed ? `Buy now — ${priceLabel}` : `Subscribe to unlock · ${priceLabel} after`}
      </button>
      {error ? (
        <p className="mt-2 text-sm" style={{ color: "var(--rust)" }}>
          {error}
        </p>
      ) : null}
      <PaywallModal
        open={paywallOpen}
        onClose={() => setPaywallOpen(false)}
        creatorId={creator.id}
        creatorName={creator.displayName}
        creatorAccent={creator.accentColor}
        plan={plan}
        signedIn={signedIn}
      />
    </>
  );
}
