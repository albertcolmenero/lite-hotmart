import { NextResponse } from "next/server";
import { getCreatorForCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function GET() {
  const creator = await getCreatorForCurrentUser();
  if (!creator) return NextResponse.redirect(new URL("/onboarding", APP_URL));

  let accountId = creator.stripeAccountId;

  if (!accountId) {
    // Note: we don't pre-fill `business_profile.url` here because Stripe
    // rejects URLs it can't publicly resolve (e.g. localhost during dev).
    // The creator fills this in during Express onboarding, and we can
    // patch it later via `accounts.update` once we know the real domain.
    const isPublicUrl = /^https?:\/\/(?!localhost)/.test(APP_URL);
    const account = await stripe.accounts.create({
      type: "express",
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      metadata: { creatorId: creator.id },
      ...(isPublicUrl
        ? {
            business_profile: {
              name: creator.displayName,
              url: `${APP_URL}/${creator.slug}`,
            },
          }
        : {}),
    });
    accountId = account.id;
    await db.creator.update({
      where: { id: creator.id },
      data: { stripeAccountId: accountId },
    });
  }

  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${APP_URL}/api/stripe/connect/onboard`,
    return_url: `${APP_URL}/api/stripe/connect/return`,
    type: "account_onboarding",
  });

  return NextResponse.redirect(link.url);
}
