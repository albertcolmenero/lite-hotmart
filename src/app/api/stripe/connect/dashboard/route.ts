import { NextResponse } from "next/server";
import { getCreatorForCurrentUser } from "@/lib/auth";
import { stripe } from "@/lib/stripe";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function GET() {
  const creator = await getCreatorForCurrentUser();
  if (!creator?.stripeAccountId) {
    return NextResponse.redirect(new URL("/studio/plan", APP_URL));
  }
  const link = await stripe.accounts.createLoginLink(creator.stripeAccountId);
  return NextResponse.redirect(link.url);
}
