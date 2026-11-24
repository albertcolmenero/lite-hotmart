import { execSync } from "node:child_process";
import { requireTestDatabaseUrl } from "./test-db";

/**
 * Bring the local test database up to date through the versioned migrations
 * (the same files production applies), then fail the run if schema.prisma has
 * changes no migration covers. Tests truncate their own tables between cases.
 *
 * Needs a test database created by migrations. If it was made with `db push`
 * (Prisma error P3005), drop and recreate it — see README → Tests.
 */
export default function setup() {
  const url = requireTestDatabaseUrl();
  const env = { ...process.env, DATABASE_URL: url };
  execSync("pnpm prisma migrate deploy", { stdio: "inherit", env });
  try {
    execSync(
      `pnpm prisma migrate diff --from-url "${url}" --to-schema-datamodel prisma/schema.prisma --exit-code`,
      { stdio: "pipe", env },
    );
  } catch {
    throw new Error(
      "prisma/schema.prisma has changes with no matching migration. Generate one into " +
        "prisma/migrations (see docs/sale-prices.md → Migrations) before running tests.",
    );
  }
}
