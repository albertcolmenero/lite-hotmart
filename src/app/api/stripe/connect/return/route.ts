import { NextResponse } from "next/server";
import { getCreatorForCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { syncPlanToStripe } from "@/lib/stripe-sync";
import { stripeRouteError } from "@/lib/stripe-errors";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function GET() {
  const creator = await getCreatorForCurrentUser();
  if (!creator || !creator.stripeAccountId) {
    return NextResponse.redirect(new URL("/studio/plan", APP_URL));
  }

  try {
    const account = await stripe.accounts.retrieve(creator.stripeAccountId);
    const onboarded = Boolean(account.details_submitted && account.charges_enabled);

    const updated = await db.creator.update({
      where: { id: creator.id },
      data: { stripeOnboarded: onboarded },
    });

    // If the creator just became live, sync their existing plan so Subscribe
    // buttons start working immediately.
    if (onboarded) {
      const plan = await db.plan.findUnique({ where: { creatorId: updated.id } });
      if (plan) {
        await syncPlanToStripe(updated, plan).catch((err) => {
          console.error("[stripe-sync] plan sync after onboarding failed", err);
        });
      }
    }

    const flag = onboarded ? "stripe" : "stripe-pending";
    return NextResponse.redirect(new URL(`/studio/plan?saved=${flag}`, APP_URL));
  } catch (err) {
    return stripeRouteError(err, "stripe/connect/return", { creatorId: creator.id });
  }
}
