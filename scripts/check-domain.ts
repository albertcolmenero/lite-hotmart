/**
 * Diagnose why a host doesn't resolve through middleware.
 *
 * Usage:
 *   pnpm check:domain studio.lite-creator.com
 *   pnpm check:domain                     # lists every Creator with a customDomain
 *
 * Reads DATABASE_URL from .env via the Prisma client. Run against whatever DB
 * your DATABASE_URL points at — typically Neon production.
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

function normalizeHost(host: string): string {
  return host.toLowerCase().trim().replace(/\.$/, "").replace(/:\d+$/, "");
}

async function listAll() {
  const rows = await db.creator.findMany({
    where: { customDomain: { not: null } },
    select: {
      slug: true,
      displayName: true,
      customDomain: true,
      customDomainStatus: true,
      published: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });
  if (rows.length === 0) {
    console.log("No creators have a customDomain set.");
    return;
  }
  console.log(`\nFound ${rows.length} creator(s) with a customDomain:\n`);
  for (const c of rows) {
    console.log(`  ${c.customDomain}`);
    console.log(`    slug:         ${c.slug}`);
    console.log(`    displayName:  ${c.displayName}`);
    console.log(`    status:       ${c.customDomainStatus ?? "(null)"}`);
    console.log(`    published:    ${c.published}`);
    console.log("");
  }
}

async function checkOne(rawHost: string) {
  const host = normalizeHost(rawHost);
  console.log(`\n┌─ Checking custom-domain resolution`);
  console.log(`│  input:           ${rawHost}`);
  console.log(`│  normalized:      ${host}`);
  console.log(`│  DATABASE_URL:    ${maskUrl(process.env.DATABASE_URL ?? "(unset)")}`);
  console.log(`└─`);

  // Exact match
  const exact = await db.creator.findUnique({
    where: { customDomain: host },
    select: {
      id: true,
      slug: true,
      displayName: true,
      customDomain: true,
      customDomainStatus: true,
      published: true,
    },
  });

  if (exact) {
    console.log("\n✓ Found an exact match on Creator.customDomain:\n");
    console.log(JSON.stringify(exact, null, 2));
    const ok =
      exact.customDomainStatus === "verified" || exact.customDomainStatus === "active";
    console.log("");
    if (ok && exact.published) {
      console.log("✅ Status looks good — middleware should resolve this host.");
    } else if (!ok) {
      console.log(
        `⚠️  customDomainStatus is "${exact.customDomainStatus ?? "(null)"}" — lookup requires "verified" or "active". ` +
          `Use \`pnpm check:domain ${rawHost} --force-verify\` to flip it for testing.`,
      );
    } else if (!exact.published) {
      console.log(
        `⚠️  Creator is not published. The storefront layout 404s for non-owners when published=false. ` +
          `Publish from /studio/publish.`,
      );
    }
  } else {
    console.log("\n✗ No Creator row matches Creator.customDomain exactly.");
    // Look for fuzzy matches
    const fuzzy = await db.creator.findMany({
      where: {
        OR: [
          { customDomain: { contains: host.split(".").slice(-2).join(".") } },
          { slug: { equals: host.split(".")[0] } },
        ],
      },
      select: {
        slug: true,
        customDomain: true,
        customDomainStatus: true,
      },
      take: 5,
    });
    if (fuzzy.length > 0) {
      console.log("\nClosest rows found:");
      for (const f of fuzzy) {
        console.log(`  slug=${f.slug}  customDomain=${f.customDomain ?? "(null)"}  status=${f.customDomainStatus ?? "(null)"}`);
      }
    }
    console.log(
      `\nFix: attach this host to a Creator. Either via the /studio/settings UI or a direct DB write:\n` +
        `  UPDATE "Creator"\n     SET "customDomain" = '${host}',\n         "customDomainStatus" = 'verified'\n   WHERE slug = '<slug>';`,
    );
  }

  // --force-verify support
  if (process.argv.includes("--force-verify") && exact) {
    await db.creator.update({
      where: { id: exact.id },
      data: { customDomainStatus: "verified" },
    });
    console.log(`\n→ Forced customDomainStatus = "verified" for slug=${exact.slug}.`);
  }
}

function maskUrl(url: string): string {
  return url.replace(/(:\/\/[^:]+):[^@]+@/, "$1:****@");
}

async function main() {
  const arg = process.argv[2];
  if (!arg || arg.startsWith("--")) {
    await listAll();
  } else {
    await checkOne(arg);
  }
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error("error:", e);
    await db.$disconnect();
    process.exit(1);
  });
