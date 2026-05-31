import { NextResponse } from "next/server";
import { getCreatorForCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { stripeRouteError } from "@/lib/stripe-errors";
import { log } from "@/lib/log";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function GET() {
  const creator = await getCreatorForCurrentUser();
  if (!creator) return NextResponse.redirect(new URL("/onboarding", APP_URL));

  try {
    let accountId = creator.stripeAccountId;

    // A stored account id can go stale: created under a different Stripe key or
    // mode (test vs live), or deleted. If we can't retrieve it under the key in
    // use now, drop it so onboarding self-heals instead of dead-ending on
    // accountLinks.create ("account not connected to your platform").
    let recreating = false;
    if (accountId) {
      try {
        await stripe.accounts.retrieve(accountId);
      } catch {
        log("warn", "stored stripeAccountId invalid for current key; recreating", {
          creatorId: creator.id,
          staleAccountId: accountId,
        });
        accountId = null;
        recreating = true;
        await db.creator.update({
          where: { id: creator.id },
          data: { stripeAccountId: null, stripeOnboarded: false },
        });
      }
    }

    if (!accountId) {
      // Note: we don't pre-fill `business_profile.url` here because Stripe
      // rejects URLs it can't publicly resolve (e.g. localhost during dev).
      // The creator fills this in during Express onboarding, and we can
      // patch it later via `accounts.update` once we know the real domain.
      const isPublicUrl = /^https?:\/\/(?!localhost)/.test(APP_URL);
      const account = await stripe.accounts.create(
        {
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
        },
        // Stable key so a double-submit can't mint duplicate accounts. Skip it
        // when recreating after a stale id so we always get a fresh account and
        // never replay a since-deleted one via idempotency.
        recreating ? {} : { idempotencyKey: `connect_acct_${creator.id}` },
      );
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
  } catch (err) {
    return stripeRouteError(err, "stripe/connect/onboard", { creatorId: creator.id });
  }
}
