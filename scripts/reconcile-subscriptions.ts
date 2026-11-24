/**
 * Recover local Subscriptions from Stripe for a creator's connected account —
 * a safety net for missed/failed webhooks. Pulls the connected account's live
 * subscriptions and upserts the local Subscription + Entitlement through the same
 * syncSubscriptionFromStripe the webhook uses.
 *
 * Must run with the LIVE platform key (the connected account is live):
 *   STRIPE_SECRET_KEY=sk_live_... pnpm tsx scripts/reconcile-subscriptions.ts anamamovement
 *   STRIPE_SECRET_KEY=sk_live_... pnpm tsx scripts/reconcile-subscriptions.ts anamamovement --apply
 */
import Stripe from "stripe";
import { db } from "../src/lib/db";
import { syncSubscriptionFromStripe } from "../src/lib/subscription-sync";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", { apiVersion: "2026-04-22.dahlia" });
const APPLY = process.argv.includes("--apply");

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.log("usage: reconcile-subscriptions.ts <creatorSlug> [--apply]");
    return;
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    console.log("STRIPE_SECRET_KEY is required (use the LIVE key).");
    return;
  }
  if (process.env.STRIPE_SECRET_KEY.startsWith("sk_test")) {
    console.log(
      "⚠️  You're using a TEST key. Live connected accounts (acct_… created via live\n" +
        "    OAuth) are NOT accessible with a test key — this will fail with account_invalid.\n" +
        "    Re-run with the LIVE key:\n" +
        `      STRIPE_SECRET_KEY='sk_live_…' pnpm reconcile:subscriptions ${process.argv[2] ?? "<slug>"}${APPLY ? " --apply" : ""}\n`,
    );
  }
  const creator = await db.creator.findUnique({ where: { slug } });
  if (!creator?.stripeAccountId) {
    console.log(`No connected creator for slug "${slug}".`);
    return;
  }
  console.log(`\nMode: ${APPLY ? "APPLY (writing)" : "dry run"} · account ${creator.stripeAccountId}\n`);

  const subs = await stripe.subscriptions.list(
    { status: "all", limit: 100 },
    { stripeAccount: creator.stripeAccountId },
  );
  console.log(`Stripe returned ${subs.data.length} subscription(s).\n`);

  let recorded = 0;
  for (const sub of subs.data) {
    // Same code path as the webhook (customer.subscription.created/updated).
    const outcome = await syncSubscriptionFromStripe(sub, creator.stripeAccountId, {
      dryRun: !APPLY,
    });
    if (outcome.kind === "skipped") {
      console.log(`  ! ${sub.id}: skipped (${outcome.reason})`);
      continue;
    }
    console.log(
      `  ${APPLY ? "→" : "·"} ${sub.id}  status=${outcome.status}  user=${outcome.userId}  planPrice=${outcome.planPriceId}  ends=${outcome.periodEnd.toISOString().slice(0, 10)}`,
    );
    recorded++;
  }

  console.log(`\n${APPLY ? "Recorded" : "Would record"} ${recorded} subscription(s).`);
  if (!APPLY) console.log("Re-run with --apply (and a LIVE key) to write.");
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error("error:", e);
    await db.$disconnect();
    process.exit(1);
  });
