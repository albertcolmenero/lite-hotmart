/**
 * Guard for the test database. Tests reset and truncate their database, so they
 * may only ever point at a local, disposable one:
 *   - URL comes from TEST_DATABASE_URL (never DATABASE_URL)
 *   - host is localhost / 127.0.0.1 / ::1
 *   - database name contains "test"
 */
export function requireTestDatabaseUrl(): string {
  const raw = process.env.TEST_DATABASE_URL;
  if (!raw) {
    throw new Error(
      "TEST_DATABASE_URL is not set. Point it at a local, disposable Postgres, e.g.\n" +
        "  TEST_DATABASE_URL=postgresql://postgres@localhost:5432/lite_hotmart_test\n" +
        "in .env.test (or your shell). See README → Tests.",
    );
  }
  const url = new URL(raw);
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const dbName = url.pathname.replace(/^\//, "");
  if (!["localhost", "127.0.0.1", "::1"].includes(host)) {
    throw new Error(`Refusing to run tests against non-local database host "${host}".`);
  }
  if (!dbName.includes("test")) {
    throw new Error(`Refusing to run tests against database "${dbName}" (name must contain "test").`);
  }
  return raw;
}
