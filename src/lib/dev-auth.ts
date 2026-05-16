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
 * Skip Stripe entirely. Subscribe / Buy actions create the Subscription /
 * Purchase / Entitlement rows directly. Default ON in V2 (Stripe wired later).
 */
export const BYPASS_PAYMENTS = process.env.BYPASS_PAYMENTS !== "0";

export const DEV_CLERK_ID = "dev_user_local";
export const DEV_EMAIL = "dev@local.test";
export const DEV_NAME = "Dev Creator";
export const DEV_CREATOR_SLUG = "dev";
