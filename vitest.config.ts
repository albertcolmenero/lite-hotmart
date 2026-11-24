import fs from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";
import { defineConfig } from "vitest/config";

// Only TEST_DATABASE_URL is taken from .env.test, so the app's DATABASE_URL
// (Neon) can never leak into a test run. tests/test-db.ts refuses non-local DBs.
const envTestPath = path.resolve(__dirname, ".env.test");
if (!process.env.TEST_DATABASE_URL && fs.existsSync(envTestPath)) {
  const fromFile = parseEnv(fs.readFileSync(envTestPath, "utf8")).TEST_DATABASE_URL;
  if (fromFile) process.env.TEST_DATABASE_URL = fromFile;
}

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    environment: "node",
    globalSetup: ["tests/global-setup.ts"],
    setupFiles: ["tests/setup-env.ts"],
    // One shared test database: run files serially so truncation can't race.
    fileParallelism: false,
  },
});
