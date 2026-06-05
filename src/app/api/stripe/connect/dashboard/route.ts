import { NextResponse } from "next/server";
import { getCreatorForCurrentUser } from "@/lib/auth";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * Send the creator to their Stripe dashboard.
 *
 * Standard accounts (connected via OAuth) own a full Stripe account, so they log
 * in directly at dashboard.stripe.com — there's no platform login link to mint
 * (createLoginLink is Express-only and errors on Standard).
 */
export async function GET() {
  const creator = await getCreatorForCurrentUser();
  if (!creator?.stripeAccountId) {
    return NextResponse.redirect(new URL("/studio/plan", APP_URL));
  }
  return NextResponse.redirect("https://dashboard.stripe.com/");
}
