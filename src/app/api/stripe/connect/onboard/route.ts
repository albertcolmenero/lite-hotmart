import { NextResponse } from "next/server";
import { getCreatorForCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { STRIPE_CONNECT_CLIENT_ID } from "@/lib/stripe";
import { stripeRouteError } from "@/lib/stripe-errors";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * Start "Connect with Stripe" (Standard accounts via OAuth).
 *
 * Sends the creator to Stripe's hosted authorize page where — if they're logged
 * in — they pick their EXISTING Stripe account and approve. No new company, no
 * data re-entry, and the account keeps its own country. We persist a single-use
 * CSRF nonce (state) that the return callback verifies.
 */
export async function GET() {
  const creator = await getCreatorForCurrentUser();
  if (!creator) return NextResponse.redirect(new URL("/onboarding", APP_URL));

  try {
    if (!STRIPE_CONNECT_CLIENT_ID) {
      throw new Error(
        "STRIPE_CONNECT_CLIENT_ID is not set — register a Connect OAuth app (Dashboard → Settings → Connect → OAuth) and add its ca_… client id.",
      );
    }

    // CSRF nonce, stored server-side and checked on return.
    const state = crypto.randomUUID();
    await db.creator.update({
      where: { id: creator.id },
      data: { stripeOAuthState: state },
    });

    const authorize = new URL("https://connect.stripe.com/oauth/authorize");
    authorize.searchParams.set("response_type", "code");
    authorize.searchParams.set("client_id", STRIPE_CONNECT_CLIENT_ID);
    // read_write is required to create Products/Prices and charges on the
    // account; the Standard default is read_only.
    authorize.searchParams.set("scope", "read_write");
    authorize.searchParams.set("redirect_uri", `${APP_URL}/api/stripe/connect/return`);
    authorize.searchParams.set("state", state);

    return NextResponse.redirect(authorize.toString());
  } catch (err) {
    return stripeRouteError(err, "stripe/connect/onboard", { creatorId: creator.id });
  }
}
