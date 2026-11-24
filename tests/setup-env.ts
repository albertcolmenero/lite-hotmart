import { requireTestDatabaseUrl } from "./test-db";

// Runs before each test file is imported, so the Prisma client in src/lib/db
// connects to the test database, never to the DATABASE_URL in .env.
process.env.DATABASE_URL = requireTestDatabaseUrl();
// Always placeholders: tests must never reach a real Stripe account.
process.env.STRIPE_SECRET_KEY = "sk_test_placeholder";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_placeholder";
