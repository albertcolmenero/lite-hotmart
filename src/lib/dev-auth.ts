/**
 * Dev-only auth bypass. When DEV_AUTH_BYPASS=1, the app skips Clerk entirely
 * and assumes you are signed in as the seeded dev user.
 *
 * Use it to navigate the whole app without configuring Clerk locally:
 *   1. Set DEV_AUTH_BYPASS=1 in .env.local
 *   2. Run `pnpm db:seed` to create the dev user + creator + sample data
 *   3. Run `pnpm dev`
 *
 * NEVER set DEV_AUTH_BYPASS=1 in production.
 */
export const IS_DEV_BYPASS = process.env.DEV_AUTH_BYPASS === "1";

/**
 * Force-skip Stripe. When set, Subscribe / Buy actions create the Subscription /
 * Purchase / Entitlement rows directly instead of charging.
 *
 * OPT-IN ONLY (`=1`). It defaults OFF so production charges real cards. Even
 * when off, creators who haven't completed Stripe onboarding still fall back to
 * the free path (see `creatorIsLive` in payments.ts) — so the dev seed creator
 * keeps working without this flag. NEVER set BYPASS_PAYMENTS=1 in production:
 * it would hand out subscriptions and courses for free.
 */
export const BYPASS_PAYMENTS = process.env.BYPASS_PAYMENTS === "1";

export const DEV_CLERK_ID = "dev_user_local";
export const DEV_EMAIL = "dev@local.test";
export const DEV_NAME = "Dev Creator";
export const DEV_CREATOR_SLUG = "dev";
