import { execSync } from "node:child_process";
import { requireTestDatabaseUrl } from "./test-db";

/**
 * Bring the local test database to the current schema before the run.
 * Non-destructive push: tests truncate their own tables between cases. If a
 * schema change can't be pushed without data loss, drop and recreate the local
 * test database by hand (see README → Tests).
 */
export default function setup() {
  const url = requireTestDatabaseUrl();
  execSync("pnpm prisma db push --skip-generate", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url },
  });
}
