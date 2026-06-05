import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  // Allow build to succeed without the key; runtime calls will fail loudly.
  // eslint-disable-next-line no-console
  console.warn("STRIPE_SECRET_KEY is not set");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "sk_test_placeholder", {
  apiVersion: "2026-04-22.dahlia",
  typescript: true,
});

// Connect OAuth application client id (ca_…). Used to build the "Connect with
// Stripe" authorize URL so creators link an EXISTING account. Register it at
// Dashboard → Settings → Connect → Onboarding options → OAuth.
export const STRIPE_CONNECT_CLIENT_ID = process.env.STRIPE_CONNECT_CLIENT_ID ?? "";

// Platform take rate in basis points (e.g., 800 = 8%).
export const PLATFORM_FEE_BPS = Number(process.env.PLATFORM_FEE_BPS ?? 800);

export function applicationFeeAmount(amountCents: number) {
  return Math.round((amountCents * PLATFORM_FEE_BPS) / 10_000);
}
