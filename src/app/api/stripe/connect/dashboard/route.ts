import { NextResponse } from "next/server";
import { getCreatorForCurrentUser } from "@/lib/auth";
import { APP_URL } from "@/lib/app-url";

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
