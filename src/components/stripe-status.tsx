import Link from "next/link";

type Status = "not_connected" | "onboarding" | "connected";

export function getStripeStatus(creator: {
  stripeAccountId: string | null;
  stripeOnboarded: boolean;
}): Status {
  if (!creator.stripeAccountId) return "not_connected";
  if (!creator.stripeOnboarded) return "onboarding";
  return "connected";
}

export function StripeStatusCard({
  creator,
  showTitle = true,
}: {
  creator: { stripeAccountId: string | null; stripeOnboarded: boolean };
  showTitle?: boolean;
}) {
  const status = getStripeStatus(creator);
  const testMode = (process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_test");

  return (
    <div className="space-y-3">
      {showTitle ? (
        <header>
          <h2 className="text-h3">Payouts</h2>
          <p className="mt-1 text-sm" style={{ color: "var(--lichen)" }}>
            Connect Stripe to start collecting subscription and course payments.
          </p>
        </header>
      ) : null}

      {status === "not_connected" ? (
        <div
          className="p-4 rounded-md flex items-start gap-3"
          style={{
            background: "color-mix(in srgb, var(--amber) 10%, var(--paper))",
            border: "1px solid color-mix(in srgb, var(--amber) 30%, var(--bone))",
          }}
        >
          <Pill color="var(--amber)" label="Not connected" />
          <div className="flex-1 text-sm" style={{ color: "var(--ink)" }}>
            Until you connect Stripe, subscribe buttons are hidden on your storefront.
          </div>
          <Link
            href="/api/stripe/connect/onboard"
            className="btn btn-primary shrink-0"
          >
            Connect Stripe
          </Link>
        </div>
      ) : null}

      {status === "onboarding" ? (
        <div
          className="p-4 rounded-md flex items-start gap-3"
          style={{
            background: "color-mix(in srgb, var(--amber) 10%, var(--paper))",
            border: "1px solid color-mix(in srgb, var(--amber) 30%, var(--bone))",
          }}
        >
          <Pill color="var(--amber)" label="Onboarding in progress" />
          <div className="flex-1 text-sm" style={{ color: "var(--ink)" }}>
            Stripe needs a few more details before you can take payments.
          </div>
          <Link
            href="/api/stripe/connect/onboard"
            className="btn btn-primary shrink-0"
          >
            Continue onboarding
          </Link>
        </div>
      ) : null}

      {status === "connected" ? (
        <div className="card p-4 flex items-center gap-3">
          <Pill color="var(--moss)" label="Connected" />
          <div className="flex-1">
            <div className="text-sm" style={{ color: "var(--ink)", fontWeight: 500 }}>
              {creator.stripeAccountId?.slice(0, 8)}…{creator.stripeAccountId?.slice(-5)}
            </div>
            <div className="text-mono-sm mt-0.5" style={{ color: "var(--lichen)" }}>
              {testMode ? "Test mode" : "Live mode"}
            </div>
          </div>
          <Link
            href="/api/stripe/connect/dashboard"
            target="_blank"
            className="btn btn-secondary shrink-0"
          >
            Open Stripe dashboard
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function Pill({ color, label }: { color: string; label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-medium shrink-0 mt-0.5"
      style={{ color }}
    >
      <span
        className="inline-block w-1.5 h-1.5 rounded-full"
        style={{ background: "currentColor" }}
      />
      {label}
    </span>
  );
}
