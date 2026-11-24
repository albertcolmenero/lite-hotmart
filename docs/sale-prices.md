# Sale prices

Creators set a temporary lower price on a course or on any membership billing
option. The storefront shows the regular price struck through, the sale price,
and when the sale ends. Prices return to normal on their own.

## Decisions

| Decision | Choice | Why |
|---|---|---|
| How a sale reaches Stripe | A Stripe **coupon** on the creator's connected account, applied at Checkout | One mechanism for courses and plans. A coupon can expire after N billing periods, which a second Price can't. The regular Price never changes, so renewals keep matching. |
| How long a subscriber keeps the sale price | Creator chooses: **first N billing periods** (1–24) or **forever** | Covers launch offers and "founding member" pricing |
| When a sale is on | Worked out on each request from `saleStartsAt` / `saleEndsAt` (half-open window `[start, end)`) | No scheduled job. The same inputs always give the same answer. |
| Bad stored data | Fails closed: no sale shown, regular price charged | Never display terms we can't honor |
| Scope | One sale per course or billing option. No codes, countdowns, store-wide sales, or changes to existing subscribers. | Smallest version that fits the launch / Black Friday job |

## Where the rules live

`src/lib/pricing.ts` is the only place that decides a current price
(`effectivePrice`, `effectivePlanPrice`) and whether a creator's sale is valid
(`validateSale`). Storefront, studio and Checkout must call it, and must never
compare dates or prices themselves. Tests: `tests/pricing.test.ts`.

## Data

All new columns are nullable (migration `1_sale_prices`):

- `PlanPrice`: `salePriceCents`, `saleStartsAt`, `saleEndsAt`, `saleDuration`
  (`periods` | `forever`), `salePeriods`, `saleStripeCouponId`, `saleCouponFingerprint`
- `Course`: the same, without the duration fields
- `Subscription`: `discountCents`, `discountEndsAt`, filled from Stripe's
  subscription discount so revenue figures can use the price actually paid

## Phases

| Phase | What | Status |
|---|---|---|
| 0 | Webhook finds the right billing option for subscribers on archived prices; test harness | Done (branch `fix/subscription-renewal-price-lookup`) |
| 1 | Baseline migration, sale columns, `pricing.ts` and tests | Done |
| 2 | Checkout + Stripe coupon sync; course fee from the price charged; Checkout expires when the sale ends; webhook records the discount | Done |
| 3 | Studio: sale fields on the plan and course forms | Done |
| 4 | Storefront: strike-through, "then €X" wording, "Sale ends" | Done |
| 5 | Revenue figures use the discount | Done |

## Checkout behaviour (phase 2)

- Checkout always uses the regular Stripe Price. During a sale it adds
  `discounts: [{ coupon }]`, using a coupon on the creator's account from
  `ensurePlanPriceSaleCoupon` / `ensureCourseSaleCoupon` in `stripe-sync.ts`.
- The coupon is created only when its inputs change: regular price, sale price,
  currency, duration, end date, or product. The coupon id and inputs are stored
  on the row. A Stripe idempotency key built from those inputs makes
  simultaneous checkouts share one coupon.
- Old coupons are **not deleted**. Buyers can't redeem them without our Checkout,
  because we create no promotion codes. `redeem_by` expires them with the sale.
  Deleting one could break a Checkout page still open at the sale price.
- Buyers see the coupon name "Sale" on Stripe Checkout and on invoices.
- A Checkout Session opened during a sale expires when the sale ends. Stripe
  needs at least 30 minutes, so in a sale's final half hour a buyer gets up to
  31 minutes at the sale price.
- The course platform fee is 8% of what the buyer pays: the sale price during a sale.
- Checkout puts `discountCents` and `discountPeriods` on the subscription's
  metadata. The webhook stores them on `Subscription`, with the end date
  counted from Stripe's `start_date`, so replaying an event writes the same
  value. When the Stripe subscription has no discount left, ours is cleared.
  A coupon a creator adds by hand in Stripe has no metadata, so it isn't
  recorded.
- The test-mode path without Stripe (`BYPASS_PAYMENTS`, or a creator not yet on
  Stripe) records the same discount and charges the sale price.

Tests: `tests/checkout-sale.test.ts` (checkout against the real test database,
with Stripe faked), `tests/pricing.test.ts`.

## Studio (phase 3)

- **Plan page, Sale card:** one sale window (start, end) shared by every
  billing option, plus a sale price and "for the first N periods" or "forever"
  per billing option. The window is saved onto each billing option that has a
  sale price. A blank sale price means no sale.
- **Course form:** sale price plus its own start and end.
- **Dates:** entered in the creator's browser time zone, shown on the form, and
  sent to the server as UTC.
- **Validation:** `lib/sale-form.ts` reads the form; the browser and the server
  actions both run it with `validateSale`. The browser blocks submit with a
  message on the field at fault. The server rejects again before writing
  anything, so a bad sale can't half-save the plan.
- **Ended sales:** shown as no sale, so saving the form clears them instead of
  failing on a past end date.
- **Known gaps:**
  - Changing the currency selector doesn't update the sale fields' currency
    symbol until the plan is saved.
  - An end date that passes while the page is open is rejected by the server
    (error page) rather than in the browser.

## Storefront (phase 4)

- `toPlanDisplay` and `coursePriceDisplay` (`lib/plan-display.ts`) give each
  price as of render time, using the same `pricing.ts` rules as Checkout: the
  price paid now, the regular price while on sale, the sale end, and the terms.
  Pages and components never work out sale prices themselves.
- `saleTermsText` gives the wording buyers see before subscribing, e.g.
  "for your first 3 months, then $15.00/mo", or for a forever sale "and keep
  this price while you're subscribed". The price after the sale is always shown.
- `components/sale-price.tsx`: `SalePrice` shows the regular price crossed
  out, then the sale price. `SaleEndsNote` shows the end in the visitor's own
  time zone; it renders nothing on the server and fills in after hydration.
- Where a sale shows: the landing plan card (a "Sale · ends …" chip replaces
  "Save up to X%"), the paywall modal, course cards (landing, courses, category,
  favourites), and the course page (buy button note and price line).
- "Save X% vs monthly" is worked out from the prices people pay now, so a
  monthly sale can shrink or remove the badge on longer billing options.
- Every storefront page reads the request headers or the signed-in viewer, so
  pages render on each request: a scheduled sale appears and ends on time
  with no cache to clear.
- Studio pages that show plan prices (dashboard, publish) also show the price
  paid now.

## Revenue (phase 5)

- `lib/revenue.ts` is the one place that works out what a subscriber pays
  (`subscriptionPeriodPrice`) and MRR (`mrrCents`, `mrrSeries`). The dashboard,
  analytics and subscribers pages call it. Before this, two pages each had
  their own copy of the MRR maths.
- A discount counts until `discountEndsAt`, or for good when that is null. The
  30-day series checks it at the start of each day, so a sale ending mid-month
  shows as a step up in MRR.
- With no discounts, the numbers are the same as before: checked against the
  old page code on 500 random subscriptions.
- The subscribers table shows the regular price crossed out while a
  subscriber's discount lasts.
- **Known limit (already true before sales):** a subscriber still on an old
  price after the creator changed it is counted at the current price. We don't
  store the old amount locally.

Still to check in Stripe test mode (not possible from the test suite):
- Does a limited coupon's window start at signup, so a trial uses up part of it?
- Does "first 3 months" give exactly three discounted invoices?

## Migrations

The repo used `prisma db push` until phase 1. It now uses versioned migrations
in `prisma/migrations`. `0_init` is a baseline generated from the schema; a
read-only compare showed the production database matched it exactly on
2026-11-24.

**One-time switch-over on production** (run by a person, in this order):

```bash
pnpm prisma migrate resolve --applied 0_init   # record the baseline; changes no tables
pnpm prisma migrate deploy                      # applies 1_sale_prices (adds nullable columns only)
pnpm prisma migrate status                      # should report up to date
```

From then on, never use `db push` against production. For a schema change,
generate the SQL, review it, and commit it with the schema:

```bash
createdb lite_hotmart_shadow   # once; Prisma wipes it on every compare, so never reuse the test DB
mkdir prisma/migrations/2_<name>
pnpm prisma migrate diff --from-migrations prisma/migrations \
  --to-schema-datamodel prisma/schema.prisma \
  --shadow-database-url postgresql://localhost:5432/lite_hotmart_shadow \
  --script -o prisma/migrations/2_<name>/migration.sql
```

Review the SQL before committing: any `DROP`, `SET NOT NULL`, or
`ALTER COLUMN ... TYPE` needs a written data-preservation plan first.

`pnpm test` fails if `schema.prisma` has changes that no migration covers.
