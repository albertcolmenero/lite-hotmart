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
| 2 | Checkout + Stripe coupon sync; course fee from the price charged; Checkout expires when the sale ends; webhook records the discount | Next |
| 3 | Studio: sale fields on the plan and course forms | |
| 4 | Storefront: strike-through, "then €X" wording, "Sale ends" | |
| 5 | Revenue figures use the discount | |

To check in Stripe test mode during phase 2:
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
