# lite-hotmart

A lite version of Hotmart: creators upload content (YouTube/Vimeo embeds, files, images, posts), connect Stripe, and sell memberships + one-time products to their audience. White-label per creator.

See [`/Users/albertcolmenero/.claude/plans/i-want-to-create-validated-fairy.md`](../../.claude/plans/i-want-to-create-validated-fairy.md) for the full product/scope plan.

## Stack

- **Next.js 16** (App Router) + Tailwind v4 + Server Components
- **Clerk** for auth
- **Neon** (Postgres) + **Prisma** for data
- **Stripe Connect (Express)** + **Stripe Tax** for payments
- **Resend** for email
- Hosted on **Vercel**

## Project structure

```
src/
  app/
    page.tsx                       Marketing landing
    sign-in/, sign-up/             Clerk-hosted auth
    onboarding/                    Creator setup wizard
    studio/                        Creator dashboard
      content/                     Library + new
      products/                    Tiers + one-time products
      subscribers/                 Subscriber list
      analytics/                   (stub)
      payouts/                     Stripe Connect dashboard link
      branding/                    Display name, color, fonts
      settings/
    [creatorSlug]/                 Public storefront
      p/[productSlug]/             One-time product detail
      c/[contentSlug]/             Public content (paywalled)
    library/                       Subscriber's "my library"
      [creatorSlug]/               Per-creator unlocked content
      c/[contentId]/               Watch/read viewer
      billing/                     Stripe Customer Portal
    api/
      webhooks/clerk/              User mirror
      webhooks/stripe/             Sub/purchase → Entitlement
      stripe/connect/{onboard,return,dashboard}
      stripe/checkout/{subscription,one-time}
      stripe/portal/
  lib/
    db.ts                          Prisma singleton
    stripe.ts                      Stripe SDK + fee helpers
    auth.ts                        Clerk → DB user mirror
    entitlements.ts                Paywall resolver (THE core)
    utils.ts
  middleware.ts                    Clerk route protection
prisma/schema.prisma               User, Creator, Tier, Product,
                                   Content, AccessRule, Subscription,
                                   Purchase, Entitlement, Comment
```

## Setup

1. **Install dependencies**:
   ```bash
   pnpm install
   ```

2. **Provision Neon**: create a project at [neon.tech](https://neon.tech), copy the pooled connection string into `DATABASE_URL`.

3. **Provision Clerk**: create an app at [clerk.com](https://clerk.com), copy publishable & secret keys. Add a webhook endpoint pointing to `https://your-app/api/webhooks/clerk` and copy the signing secret into `CLERK_WEBHOOK_SECRET`. Subscribe to `user.created`, `user.updated`, `user.deleted`.

4. **Provision Stripe**: in [Stripe](https://stripe.com), enable **Connect** (Express). For local dev, run `stripe listen --forward-to localhost:3000/api/webhooks/stripe --forward-connect-to localhost:3000/api/webhooks/stripe` and use the printed signing secret as `STRIPE_WEBHOOK_SECRET`. Required Connect events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `payment_intent.succeeded`

5. **Copy env**:
   ```bash
   cp .env.example .env.local
   ```
   Fill in all values.

6. **Push schema**:
   ```bash
   pnpm prisma db push
   ```

7. **Run dev**:
   ```bash
   pnpm dev
   ```

Open http://localhost:3000.

## Scripts

- `pnpm dev` — start dev server
- `pnpm build` — production build
- `pnpm start` — run production build
- `pnpm prisma studio` — explore the database
- `pnpm prisma db push` — apply schema changes (dev)
- `pnpm prisma migrate dev` — create and apply a migration

## Paywall model

Every gated request resolves through the `Entitlement` table (`src/lib/entitlements.ts`):

- Subscription checkout → Stripe webhook `customer.subscription.created` → row in `Subscription` + `Entitlement(source=subscription, tierId, expiresAt=currentPeriodEnd)`.
- One-time purchase → Stripe webhook `checkout.session.completed (mode=payment)` → row in `Purchase` + `Entitlement(source=purchase, productId, expiresAt=null)`.
- Subscription canceled → entitlement `expiresAt` stays at `currentPeriodEnd`; access drops automatically when the date passes.
- Drip: if `Content.dripDays > 0`, access via subscription is delayed by N days from `Subscription.startedAt`.

Content with **zero AccessRules is free / public.**

## Platform take rate

Set in `PLATFORM_FEE_BPS` (basis points). 800 = 8%. Applied via Stripe `application_fee_amount` (one-time) or `application_fee_percent` (subscriptions).

## Deferred for V2+

- Native video uploads + transcoding (Mux/Cloudflare Stream)
- Affiliate program
- Live streaming
- Cross-creator discovery
- Mobile apps
- Custom domains
