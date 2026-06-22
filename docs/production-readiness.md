# Production-Readiness Runbook

A linear, dependency-ordered sequence to go from "demo-quality" to "safe to charge real money and onboard real creators." Work through it top to bottom. Each phase is a single shippable commit (or small PR), with verification steps before moving on.

The plan is grouped into three blocks by urgency:

- **Block A — Ship before the first real charge** (3–5 working days)
- **Block B — Ship within 2 weeks of first revenue** (4–6 working days)
- **Block C — First 90 days post-launch** (ongoing)

> **Why this order?** Sentry has to come *after* the BYPASS_PAYMENTS fix or it'll be noisy with fake-flow errors. Webhooks have to be solid *before* we add idempotency keys or transactions, because the handler logic is what we're protecting. Rate-limiting goes *after* the security audit so we know which routes need it. SEO goes last because none of it matters if the platform is broken.

---

## Progress log — 2026-05-29

First execution pass on Block A landed (verified with `tsc --noEmit` + `eslint`, all green). Code is internally consistent and deployable **without** a DB migration — the schema-dependent items were deliberately split out.

**Shipped:**
- **1.1** `BYPASS_PAYMENTS` now opt-in (`=== "1"`). Confirmed safe for dev: the non-onboarded seed creator still falls back to the free path via `creatorIsLive`. *(Was defaulting ON — meaning real charges never fired for anyone in prod.)*
- **1.2** `.env.example` sanitized: `DEV_AUTH_BYPASS=0`, `BYPASS_PAYMENTS=0`, real Neon/Clerk secrets replaced with placeholders. Verified via `git log -S` that **neither secret ever entered git history** (`.env*` is gitignored), so rotation is precautionary, not urgent.
- **1.3** IDOR closed across **7 action files** (classes/series/courses new+edit, categories edit) via a shared `assertOwned()` guard in `src/lib/ownership.ts`. Scope widened beyond tags/categories to also validate class/series/course attach (same cross-tenant leak).
- **1.4** Webhook metadata now zod-validated; invalid → logged + 200, never a crash.
- **2 (no-schema):** `charge.refunded` (full-refund guard) and `charge.dispute.created` now revoke entitlements; `account.updated` tightened with `disabled_reason` logging; multi-row handlers wrapped in `db.$transaction`; idempotency keys on both Checkout sessions.
- **3 (no-deps):** `error.tsx` (root + storefront + studio), `global-error.tsx`, `not-found.tsx`; `captureException` seam (`src/lib/observability.ts`) + structured JSON logger (`src/lib/log.ts`).
- **Bonus (Vimeo bug):** `fetchVideoThumbnail()` now derives Vimeo posters via oEmbed on save (`src/lib/video-thumbnail.ts`); backfill script ready (`pnpm backfill:vimeo`).

**Deferred (need a separate step), tracked as tasks:**
- **Backfill apply** — `pnpm backfill:vimeo --apply` writes to the shared Neon DB; needs explicit run (dry-run verified: 2 classes, both resolve).
- **2 (schema)** — `Purchase.refundedAt/disputedAt`, `Subscription.refundedAt/disputedAt`, `Creator.stripeRestrictedReason`, `WebhookEvent` dedup table. Needs a DB migration; existing upserts are already idempotent so dedup is defense-in-depth.
- **3 (Sentry)** — `@sentry/nextjs` install pending a DSN + Next 16 compat check. The `captureException` seam is the one-line plug-in point.

---

## Field-reported issues — 2026-06-19 (first-creator testing)

Captured from live testing with the first creator (Anama Movement). Ordered smallest-fix first.

- [x] **Mobile: storefront logo overlaps the nav.** _(Fixed — header now sizes the nav to content and caps the logo to its cell on mobile.)_ On a ~380px viewport the header's 3-column grid (`src/components/storefront-header.tsx:39`) gives each column ~⅓ width (~127px), but the logo is capped at `maxWidth: 180`, so it overflows its cell and collides with the centered nav (Flow / Barre / Rituals). Fix: a responsive logo cap (smaller `maxWidth` below the `sm` breakpoint) or drop the centered-nav grid for a logo + menu layout on mobile. Small CSS change. (Maps to Phase 9 — mobile polish.)

- [x] **Dead "Home page" studio nav → 404.** _(404 fixed — dead nav link removed. Rebuilding the home-page editor remains an optional feature.)_ `src/app/studio/layout.tsx:41` links to `/studio/landing`, but that route was removed when the WYSIWYG home-page editor was rolled back, so it 404s. Note: home content still *renders* on the storefront from `Creator.homeContent` — creators just can't edit it. Two directions: (a) quick — remove the dead nav item; (b) real — rebuild the home-page editor so creators can edit `homeContent`. Needs a product decision.

- [x] **Stripe Customer Portal — `/library/billing`.** _(Wired — per-subscription "Manage" button → portal session on the connected account. One-time setup: each creator must activate the Customer Portal in their connected-account dashboard.)_ Currently a placeholder ("Customer Portal isn't wired up yet" — `src/app/library/billing/page.tsx:17`). Wire `stripe.billingPortal.sessions.create({ customer, return_url })` (on the connected account, since these are direct charges) so subscribers can update their card and cancel themselves. **Already tracked as Phase 4.3** — this is the concrete trigger, and it's now higher priority since there are live subscribers who can't self-manage.

---

## Block A — Must ship before charging real money

Goal: nothing here is optional. By the end of Block A, a real creator can connect Stripe, take a real payment, and we won't lose money, leak data, or fail silently.

### Phase 0 — Production safety check (30 min)

Before touching code, confirm production isn't already exposed.

- [ ] On Vercel (Production env): confirm `DEV_AUTH_BYPASS` is **unset** or `=0`
- [ ] On Vercel (Production env): confirm `BYPASS_PAYMENTS` is **unset** or `=0`
- [ ] On Vercel (Production env): confirm `STRIPE_SECRET_KEY` starts with `sk_live_` (not `sk_test_`)
- [ ] On Vercel (Production env): confirm `STRIPE_WEBHOOK_SECRET` is the **live** signing secret from the Stripe Connect webhook endpoint
- [ ] Confirm `MIDDLEWARE_DOMAIN_LOOKUP_SECRET` is set (and matches between Vercel and the internal lookup route)
- [ ] Confirm `NEXT_PUBLIC_ROOT_DOMAIN=lite-creator.com` and `NEXT_PUBLIC_APP_URL=https://lite-creator.com`
- [ ] If any real secret was ever committed to `.env.example` or the repo (Clerk, Neon, Stripe), **rotate it now** before anything else
- [ ] Re-pull `.env.example`; confirm every value is a placeholder, not a real secret

**Verification:** `curl https://lite-creator.com/api/healthz` (if it exists) or hit `https://lite-creator.com` and confirm no dev banner shows.

---

### Phase 1 — Critical money & auth bugs (1 day)

These are the bugs an attacker or buggy dev environment can exploit to take real money or modify other creators' data.

#### 1.1 — Fix `BYPASS_PAYMENTS` default

- [ ] Open `src/lib/dev-auth.ts` line ~18
- [ ] Change `BYPASS_PAYMENTS = process.env.BYPASS_PAYMENTS !== "0"` to `BYPASS_PAYMENTS = process.env.BYPASS_PAYMENTS === "1"`
- [ ] Grep for every callsite (`rg "BYPASS_PAYMENTS"`) and confirm the meaning still holds (opt-in, not opt-out)
- [ ] Manually test: `unset BYPASS_PAYMENTS && pnpm dev` → subscribe flow must hit Stripe, not the bypass branch

**Why first:** every other money-related fix is moot if this defaults to true in any environment.

#### 1.2 — Remove `DEV_AUTH_BYPASS=1` from `.env.example`

- [ ] Set it to `DEV_AUTH_BYPASS=0` (or comment it out entirely with a warning)
- [ ] Add a banner comment: `# DO NOT SET TO 1 IN PRODUCTION — bypasses Clerk and signs you in as the dev seed user`
- [ ] Same treatment for `BYPASS_PAYMENTS`

#### 1.3 — Fix IDOR on tag/category attach

The new/edit actions for classes, series, courses, and categories let any creator connect *any* tag/category ID — including those belonging to other creators. Trivially: a creator could tag their own class with another creator's "Hips" tag, polluting that creator's catalog.

For each of these files, add an ownership check before `connect: tagIds.map(id => ({ id }))`:

- [ ] `src/app/studio/classes/new/actions.ts` (~line 66)
- [ ] `src/app/studio/classes/[id]/actions.ts` (matching update path)
- [ ] `src/app/studio/series/new/actions.ts` (~line 57)
- [ ] `src/app/studio/series/[id]/actions.ts`
- [ ] `src/app/studio/courses/new/actions.ts` (~line 62)
- [ ] `src/app/studio/courses/[id]/actions.ts`
- [ ] `src/app/studio/categories/[id]/actions.ts` (~lines 30–41)

Pattern:
```ts
const ownedTags = await db.tag.findMany({
  where: { id: { in: tagIds }, creatorId: creator.id },
  select: { id: true },
});
if (ownedTags.length !== tagIds.length) {
  throw new Error("tag does not belong to this creator");
}
```

**Verification:** create two creators in dev, try to connect creator A's tag to creator B's class via a crafted form post → should error.

#### 1.4 — Validate webhook metadata before trusting it

The Stripe webhook handler reads `session.metadata.userId / creatorId / planId / interval` and writes them straight into the DB. If those don't exist (legacy / external) we crash with a generic 500.

- [ ] In `src/app/api/webhooks/stripe/route.ts`, for each handler: parse metadata with `zod`, reject (200 + log) if invalid, never crash
- [ ] Confirm the parsed `creatorId` matches the connected account that signed the event (defense in depth)

**Verification:** send a synthetic `checkout.session.completed` event with missing metadata via `stripe trigger` → returns 200, logs structured warning, no DB write.

---

### Phase 2 — Webhook completeness (1.5 days)

Goal: Stripe's lifecycle is the source of truth. Currently we handle the happy path; we need the unhappy path so customers and creators don't see ghost entitlements.

#### 2.1 — Add `charge.refunded` handler

- [ ] In `src/app/api/webhooks/stripe/route.ts`, add case `charge.refunded`
- [ ] Look up `Purchase` by `stripePaymentIntentId` (or `Subscription` for subscription invoices)
- [ ] Mark the corresponding `Entitlement.expiresAt = now()` (revoke immediately) and set a `refundedAt` field on Purchase
- [ ] Schema change: add `Purchase.refundedAt DateTime?` and `Subscription.refundedAt DateTime?` (additive, nullable — see MEMORY.md about preserving rows)

#### 2.2 — Add `charge.dispute.created` handler

- [ ] Add case `charge.dispute.created`
- [ ] Pause the entitlement (`Entitlement.expiresAt = now()`) and flag the Purchase/Subscription with `disputedAt`
- [ ] Send a Resend email to the creator (this will get wired in Phase 4, leave a `TODO(emails)` for now)

#### 2.3 — Tighten `account.updated`

- [ ] Today we only check `details_submitted && charges_enabled`
- [ ] Also check `requirements.disabled_reason` and `requirements.currently_due`
- [ ] If account is restricted, set `creator.stripeOnboarded = false` AND raise a flag (e.g. `creator.stripeRestrictedReason`) so studio UI can show it
- [ ] Schema change: add `Creator.stripeRestrictedReason String?`

#### 2.4 — Wrap webhook handlers in DB transactions

- [ ] Every handler that writes more than one row (e.g. Subscription + Entitlement) needs `db.$transaction(...)` so we don't end up with half-written state on a crash mid-handler
- [ ] If the transaction fails, return **500** so Stripe retries

#### 2.5 — Add idempotency keys to Checkout sessions

- [ ] In `src/lib/payments.ts` lines ~99–125 (subscribe) and ~175–210 (course buy), pass `{ idempotencyKey: \`subscribe-\${userId}-\${planId}-\${interval}-\${dayBucket}\` }`
- [ ] Use a `dayBucket = new Date().toISOString().slice(0,10)` so genuine retries the same day dedupe but the customer can try again tomorrow

**Verification:** click "Subscribe" twice in rapid succession → only one Stripe Checkout session exists for that day-bucket.

#### 2.6 — Reconciliation log

- [ ] Add `WebhookEvent` model: `id`, `stripeEventId @unique`, `type`, `accountId?`, `payload`, `processedAt`, `error?`
- [ ] At the top of every webhook, `upsert` by `stripeEventId`. If already `processedAt != null`, return 200 immediately (defense against Stripe redelivery)
- [ ] On error, store the error message and let Stripe retry

---

### Phase 3 — Safety nets (1 day)

Goal: when things break (and they will), we see it and the user sees something other than a Vercel-default error page.

#### 3.1 — Error boundaries

- [ ] Create `src/app/error.tsx` (route-level error UI)
- [ ] Create `src/app/global-error.tsx` (root error UI; must include `<html>/<body>`)
- [ ] Create `src/app/[creatorSlug]/error.tsx` (storefront-specific copy: "this creator's page is having trouble; please try again")
- [ ] Create `src/app/studio/error.tsx` (studio-specific: "something broke in the studio; here's a link back to your dashboard")
- [ ] Create `src/app/not-found.tsx` if not already present

#### 3.2 — Sentry

- [ ] `pnpm add @sentry/nextjs`
- [ ] Run `npx @sentry/wizard@latest -i nextjs`
- [ ] Add `SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` to Vercel env
- [ ] Add to `error.tsx` files: `useEffect(() => Sentry.captureException(error), [error])`
- [ ] Wrap webhook handler: on any caught error, `Sentry.captureException(err, { extra: { stripeEventId, type } })`
- [ ] Wrap payments.ts Stripe calls: capture but don't swallow

#### 3.3 — Structured logging

- [ ] Replace any `console.log` in `src/app/api/**` and `src/lib/payments.ts` with a tiny logger that emits JSON: `{ ts, level, msg, ...context }`
- [ ] At minimum: log every webhook event (id, type, account) and every Checkout session creation
- [ ] Vercel's log viewer parses JSON natively — this makes incident debugging an order of magnitude faster

**End of Block A verification (do all of these as one e2e pass):**
1. Create a new creator, connect Stripe, set a plan
2. Subscribe with `4242 4242 4242 4242` → entitlement appears
3. Refund the charge in Stripe dashboard → entitlement disappears, Sentry sees no errors
4. Try to subscribe twice fast → only one Checkout session
5. Send a malformed webhook via `stripe trigger` with stripped metadata → returns 200, logs warning, no crash
6. Visit `/studio/classes/[other-creator-id]/edit` directly → 404 or 403, not silent crossover

---

## Block B — Should ship within 2 weeks of first revenue

Goal: the platform is operationally honest. Customers can self-serve, creators get notified when things happen, we're not running on `prisma db push`.

### Phase 4 — Transactional emails + self-serve (1.5 days)

Resend is installed but unused. Wire it up. The single highest churn lever is silence after a charge.

#### 4.1 — Email scaffolding

- [ ] Create `src/lib/email.ts` with `sendEmail({ to, subject, react })` helper
- [ ] Add `RESEND_API_KEY` (already in env?) and `EMAIL_FROM=Lite Creator <hello@lite-creator.com>` to Vercel
- [ ] Verify domain in Resend dashboard; configure SPF/DKIM DNS

#### 4.2 — The six transactional emails

Build with `@react-email/components` for consistent rendering:

- [ ] **Welcome** — sent on Clerk webhook `user.created` (need to add this webhook handler; see 4.4)
- [ ] **Receipt** — sent on `checkout.session.completed`, both subscription and purchase
- [ ] **Subscription started** — sent on first invoice paid; includes link to `/library/{slug}`
- [ ] **Payment failed** — sent on `invoice.payment_failed`; CTA: update card
- [ ] **Subscription canceled** — sent on `customer.subscription.deleted`; note when access ends
- [ ] **Dispute opened** — sent to **creator**, not subscriber, on `charge.dispute.created`

#### 4.3 — Customer Portal (self-serve cancellation)

- [ ] Add `/api/stripe/portal` route that creates a Customer Portal session for the current user (using `stripe.billingPortal.sessions.create({ customer, return_url })`)
- [ ] On `/library/billing` (create if missing), show a single button: "Manage subscription"
- [ ] Test cancel flow end-to-end

#### 4.4 — Clerk webhook handler

- [ ] If not already present, add `src/app/api/webhooks/clerk/route.ts`
- [ ] Verify with `svix` signature
- [ ] On `user.created`, ensure DB user row exists and trigger Welcome email

---

### Phase 5 — Rate limiting (0.5 day)

- [ ] `pnpm add @upstash/ratelimit @upstash/redis` (or Vercel KV)
- [ ] Create `src/lib/ratelimit.ts` with three buckets: `auth` (10/min/IP), `checkout` (5/min/user), `webhook` (none — Stripe's IPs are trusted)
- [ ] Apply in:
  - [ ] `/api/subscribe` route handler
  - [ ] `/api/purchase` route handler
  - [ ] `/api/stripe/connect/onboard` route handler
  - [ ] Sign-in pages? — handled by Clerk, skip
- [ ] On 429, return JSON `{ error: "rate_limited", retryAfter }` and matching HTTP status

---

### Phase 6 — Infra & data hygiene (1.5 days)

#### 6.1 — Move from `prisma db push` to `prisma migrate`

- [ ] `pnpm prisma migrate dev --name initial-baseline` — creates `prisma/migrations/` with a snapshot of the current schema
- [ ] Commit `prisma/migrations/`
- [ ] Update `package.json`: add `"build": "prisma migrate deploy && next build"` (Vercel build command becomes safe-by-default)
- [ ] **Critical:** read `prisma/migrations/<timestamp>_initial-baseline/migration.sql` and confirm it matches your current Neon schema before deploying (otherwise `migrate deploy` will try to recreate tables)
- [ ] If they don't match: use `prisma migrate resolve --applied <name>` to mark it as already applied

#### 6.2 — CI pipeline

- [ ] Create `.github/workflows/ci.yml`
- [ ] Jobs: install (pnpm), typecheck (`tsc --noEmit`), lint (`pnpm lint`), build (`pnpm build`)
- [ ] Run on push to any branch + PRs to main
- [ ] Block PRs that fail any step (branch protection rules)

#### 6.3 — Pagination

- [ ] `/studio/subscribers/page.tsx` — add `cursor`-based pagination, default page size 50
- [ ] `/studio/classes/page.tsx`, `/studio/series/page.tsx`, `/studio/courses/page.tsx` — same
- [ ] `/{creatorSlug}/practice/page.tsx` — for catalogs >50, paginate or virtualize
- [ ] `/library/page.tsx` — paginate

#### 6.4 — Backup verification

- [ ] Confirm Neon's point-in-time recovery is enabled on the production project
- [ ] Document the restore procedure in `docs/runbook-restore.md` (5 lines is fine)
- [ ] Once: actually test restoring a branch to a known timestamp

---

## Block C — First 90 days post-launch

Goal: SEO traffic, legal coverage, performance, accessibility, and the long-tail polish items.

### Phase 7 — SEO & metadata (1 day)

- [ ] Each storefront route gets `generateMetadata()`:
  - [ ] `/{creatorSlug}` — `title: creator.displayName`, `description: creator.bio`, OpenGraph image
  - [ ] `/{creatorSlug}/practice/classes/[slug]` — class title + description
  - [ ] `/{creatorSlug}/practice/series/[slug]` — same
  - [ ] `/{creatorSlug}/courses/[slug]` — same
- [ ] Marketing pages get `generateMetadata()` too (homepage, pricing if any)
- [ ] Create `src/app/sitemap.ts` — generate dynamically from `db.creator.findMany({ where: { published: true } })` + their public content
- [ ] Create `src/app/robots.ts` — allow root domain + all custom domains; disallow `/studio`, `/library`, `/api`
- [ ] Add `<meta name="theme-color">` matching the creator's accent color (already in branding)
- [ ] Add JSON-LD `Organization` schema on creator landing pages

### Phase 8 — Legal & compliance (1 day)

- [ ] Draft `/legal/terms` — Terms of Service (use a SaaS template; mention the creator-as-MoR model)
- [ ] Draft `/legal/privacy` — Privacy Policy (Clerk, Stripe, Vercel, Neon, Resend, Sentry are subprocessors)
- [ ] Draft `/legal/dmca` — takedown process
- [ ] Footer with links to all three (root + storefront layouts)
- [ ] Cookie banner: only needed if you set non-essential cookies. Clerk + Stripe set essential cookies. If we add PostHog or similar later, add then.
- [ ] Footnote on Stripe Checkout that the creator (not Lite Creator) is the merchant of record

### Phase 9 — Performance & accessibility (1–2 days)

- [ ] Replace `<img>` with `next/image` in:
  - [ ] `src/components/storefront-header.tsx` (logo)
  - [ ] Class/series/course cover images everywhere
  - [ ] Add `images.remotePatterns` to `next.config.ts` for YouTube/Vimeo thumbnails
- [ ] Lighthouse pass on `/`, `/{slug}`, `/{slug}/practice`, `/{slug}/courses/[slug]` — aim for ≥90 on all axes
- [ ] Axe DevTools pass on the same routes; fix any contrast / aria failures
- [ ] Mobile review: open every studio page on a 375px viewport and fix overflow / cramped UI

### Phase 10 — Tax & advanced billing (2 days)

- [ ] Enable Stripe Tax on the platform
- [ ] In `payments.ts`, pass `automatic_tax: { enabled: true }` to Checkout sessions and Subscriptions
- [ ] Update creator onboarding copy: "Lite Creator collects sales tax on your behalf; remittance is your responsibility"
- [ ] Add `Purchase.taxCents` / `Subscription.taxCents` (additive, nullable) to record breakdown

### Phase 11 — GDPR / data rights (1 day)

- [ ] `/library/account` → "Export my data" button → enqueues a job that emails a zip of the user's data
- [ ] "Delete my account" button → soft-delete + 30-day grace period + irrecoverable wipe job
- [ ] Document the data-retention policy in `/legal/privacy`

### Phase 12 — Long-tail polish

- [ ] Refund UI for creators (currently they have to use Stripe dashboard)
- [ ] Coupons / discount codes
- [ ] Proration on plan price changes
- [ ] Subscriber CSV export
- [ ] Search across creator's catalog
- [ ] Email broadcast composer (the V1.5 item from the product plan)

---

## How to use this document

- Tick boxes as you ship each item; this file is the source of truth for "are we ready?"
- Don't skip phases. The order encodes dependencies — fixing Sentry before BYPASS_PAYMENTS just generates noise; adding rate-limiting before fixing IDOR means attackers still drain you, just slower.
- One phase = one PR is a good default. Bigger phases (4, 6) can split.
- If a phase reveals new findings, add them as sub-bullets in place rather than starting a new doc.
- After Block A: tag the commit, deploy, take a real payment with your own card, refund it. That's the gate.
