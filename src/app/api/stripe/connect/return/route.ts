import { NextRequest, NextResponse } from "next/server";
import { getCreatorForCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { syncPlanToStripe } from "@/lib/stripe-sync";
import { stripeRouteError } from "@/lib/stripe-errors";
import { log } from "@/lib/log";
import { APP_URL } from "@/lib/app-url";

function backTo(flag: string): NextResponse {
  return NextResponse.redirect(new URL(`/studio/plan?saved=${flag}`, APP_URL));
}

/**
 * OAuth callback for "Connect with Stripe".
 *
 * Verifies the single-use CSRF state, exchanges the authorization code for the
 * connected account id (stripe_user_id), and stores it as Creator.stripeAccountId
 * — the same id space the rest of the app already uses, so nothing downstream
 * (direct charges, application fees, product/price sync) changes.
 */
export async function GET(req: NextRequest) {
  const creator = await getCreatorForCurrentUser();
  if (!creator) return NextResponse.redirect(new URL("/studio/plan", APP_URL));

  const params = req.nextUrl.searchParams;
  const expectedState = creator.stripeOAuthState;

  // Always clear the one-time nonce, whatever the outcome.
  const clearState = () =>
    db.creator.update({ where: { id: creator.id }, data: { stripeOAuthState: null } });

  // Creator denied the authorization (or Stripe returned an error).
  const oauthError = params.get("error");
  if (oauthError) {
    log("warn", "stripe oauth returned error", {
      creatorId: creator.id,
      error: oauthError,
      description: params.get("error_description"),
    });
    await clearState();
    return backTo("stripe-cancelled");
  }

  const code = params.get("code");
  const state = params.get("state");

  // CSRF: state must be present and match what we issued.
  if (!code || !state || !expectedState || state !== expectedState) {
    log("warn", "stripe oauth state/code invalid", {
      creatorId: creator.id,
      hasCode: Boolean(code),
      stateMatch: Boolean(state && expectedState && state === expectedState),
    });
    await clearState();
    return backTo("stripe-error");
  }

  try {
    await clearState();

    const token = await stripe.oauth.token({ grant_type: "authorization_code", code });
    const accountId = token.stripe_user_id;
    if (!accountId) {
      throw new Error("Stripe OAuth did not return a connected account id.");
    }

    // Pull the account to capture onboarding state + its own country.
    const account = await stripe.accounts.retrieve(accountId);
    const onboarded = Boolean(account.details_submitted && account.charges_enabled);

    const updated = await db.creator.update({
      where: { id: creator.id },
      data: {
        stripeAccountId: accountId,
        stripeOnboarded: onboarded,
        stripeAccountCountry: account.country ?? null,
      },
    });

    // Newly live → sync their plan so Subscribe buttons work immediately.
    if (onboarded) {
      const plan = await db.plan.findUnique({ where: { creatorId: updated.id } });
      if (plan) {
        await syncPlanToStripe(updated, plan).catch((err) => {
          console.error("[stripe-sync] plan sync after connect failed", err);
        });
      }
    }

    log("info", "stripe account connected via oauth", {
      creatorId: creator.id,
      accountId,
      country: account.country ?? null,
      onboarded,
    });
    return backTo(onboarded ? "stripe" : "stripe-pending");
  } catch (err) {
    return stripeRouteError(err, "stripe/connect/return", { creatorId: creator.id });
  }
}
