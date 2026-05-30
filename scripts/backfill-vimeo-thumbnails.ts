/**
 * Backfill posters for existing Vimeo classes.
 *
 * YouTube classes derive their poster at render time from the video id, but
 * Vimeo has no by-id image URL — the poster must come from Vimeo's oEmbed API
 * and be stored. Classes created before that wiring existed have
 * thumbnailUrl = null and render with a blank placeholder. This fills them in.
 *
 * The oEmbed logic here mirrors src/lib/video-thumbnail.ts (kept inline so this
 * one-off script has no app-alias / React import dependency).
 *
 * Usage:
 *   pnpm tsx scripts/backfill-vimeo-thumbnails.ts            # dry run (default)
 *   pnpm tsx scripts/backfill-vimeo-thumbnails.ts --apply    # write changes
 *
 * Reads DATABASE_URL from .env via the Prisma client. Run against whatever DB
 * your DATABASE_URL points at — typically Neon.
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const APPLY = process.argv.includes("--apply");

function vimeoId(url: string): string | null {
  const m = url.match(/vimeo\.com\/(\d+)/);
  return m?.[1] ?? null;
}

async function vimeoThumbnail(url: string): Promise<string | null> {
  const id = vimeoId(url);
  if (!id) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const endpoint =
      `https://vimeo.com/api/oembed.json` +
      `?url=${encodeURIComponent(`https://vimeo.com/${id}`)}&width=960`;
    const res = await fetch(endpoint, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { thumbnail_url?: unknown };
    const thumb = data.thumbnail_url;
    return typeof thumb === "string" && thumb.startsWith("http") ? thumb : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function maskUrl(url: string): string {
  return url.replace(/(:\/\/[^:]+):[^@]+@/, "$1:****@");
}

async function main() {
  console.log(`\nMode:          ${APPLY ? "APPLY (writing)" : "dry run (no writes)"}`);
  console.log(`DATABASE_URL:  ${maskUrl(process.env.DATABASE_URL ?? "(unset)")}\n`);

  const total = await db.class.count({ where: { videoProvider: "vimeo" } });
  const missing = await db.class.findMany({
    where: {
      videoProvider: "vimeo",
      OR: [{ thumbnailUrl: null }, { thumbnailUrl: "" }],
    },
    select: { id: true, title: true, videoUrl: true },
    orderBy: { createdAt: "asc" },
  });

  console.log(`Vimeo classes total:               ${total}`);
  console.log(`Vimeo classes missing a thumbnail: ${missing.length}\n`);

  if (missing.length === 0) {
    console.log("Nothing to backfill.");
    return;
  }

  let filled = 0;
  let failed = 0;
  for (const c of missing) {
    const thumb = await vimeoThumbnail(c.videoUrl);
    if (!thumb) {
      failed++;
      console.log(`  ✗ ${c.title}  (${c.videoUrl}) — oEmbed returned nothing`);
      continue;
    }
    console.log(`  ${APPLY ? "→" : "·"} ${c.title}  →  ${thumb}`);
    if (APPLY) {
      await db.class.update({ where: { id: c.id }, data: { thumbnailUrl: thumb } });
    }
    filled++;
  }

  console.log(
    `\n${APPLY ? "Updated" : "Would update"} ${filled} class(es)` +
      (failed ? `; ${failed} could not be resolved (private/removed video?).` : "."),
  );
  if (!APPLY && filled > 0) {
    console.log(`\nRe-run with --apply to write these changes.`);
  }
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error("error:", e);
    await db.$disconnect();
    process.exit(1);
  });
