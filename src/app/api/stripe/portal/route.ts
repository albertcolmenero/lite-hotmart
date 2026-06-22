import { NextRequest, NextResponse } from "next/server";
import { getOrCreateDbUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { stripeRouteError } from "@/lib/stripe-errors";
import { APP_URL } from "@/lib/app-url";

/**
 * Open the Stripe Customer Portal for one of the current user's subscriptions
 * (update card, cancel, view invoices).
 *
 * Direct charges put the customer on the CONNECTED account, so the portal
 * session is created there (Stripe-Account header). The connected account must
 * have the Customer Portal configured (Dashboard → Settings → Billing → Customer
 * portal); if not, Stripe returns a clear error, surfaced via stripeRouteError.
 */
export async function GET(req: NextRequest) {
  const user = await getOrCreateDbUser();
  if (!user) return NextResponse.redirect(new URL("/sign-in", APP_URL));

  const subId = req.nextUrl.searchParams.get("subscription");
  if (!subId) return NextResponse.redirect(new URL("/library/billing", APP_URL));

  // Ownership-scoped: only the subscription's own user can open its portal.
  const sub = await db.subscription.findFirst({
    where: { id: subId, userId: user.id },
    include: { plan: { include: { creator: true } } },
  });
  if (!sub || !sub.stripeCustomerId || !sub.plan.creator.stripeAccountId) {
    // No Stripe customer (e.g. a bypass/local subscription) — nothing to manage.
    return NextResponse.redirect(new URL("/library/billing", APP_URL));
  }

  try {
    const session = await stripe.billingPortal.sessions.create(
      {
        customer: sub.stripeCustomerId,
        return_url: `${APP_URL}/library/billing`,
      },
      { stripeAccount: sub.plan.creator.stripeAccountId },
    );
    return NextResponse.redirect(session.url);
  } catch (err) {
    return stripeRouteError(err, "stripe/portal", { subscriptionId: subId });
  }
}
