"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCreatorForCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { slugify, ensureUniqueSlug } from "@/lib/slug";

const schema = z.object({
  title: z.string().min(1).max(200),
  videoProvider: z.enum(["youtube", "vimeo"]),
  videoUrl: z.string().url(),
  thumbnailUrl: z.string().url().optional().nullable(),
  durationMins: z.coerce.number().int().min(0).max(600).optional().nullable(),
  description: z.string().optional().nullable(),
  visibleToPublic: z.boolean(),
  freeForEveryone: z.boolean(),
  standalone: z.boolean(),
  published: z.boolean(),
});

export async function createClassAction(formData: FormData) {
  const creator = await getCreatorForCurrentUser();
  if (!creator) throw new Error("No creator");

  const parsed = schema.parse({
    title: formData.get("title"),
    videoProvider: formData.get("videoProvider"),
    videoUrl: formData.get("videoUrl"),
    thumbnailUrl: formData.get("thumbnailUrl") || null,
    durationMins: formData.get("durationMins") || null,
    description: formData.get("description") || null,
    visibleToPublic: formData.get("visibleToPublic") === "on",
    freeForEveryone: formData.get("freeForEveryone") === "on",
    standalone: formData.get("standalone") === "on",
    published: formData.get("published") === "on",
  });

  const slug = await ensureUniqueSlug(slugify(parsed.title), async (candidate) =>
    Boolean(
      await db.class.findUnique({
        where: { creatorId_slug: { creatorId: creator.id, slug: candidate } },
      }),
    ),
  );

  const tagIds = formData.getAll("tagIds").map(String);
  const categoryIds = formData.getAll("categoryIds").map(String);

  const cls = await db.class.create({
    data: {
      creatorId: creator.id,
      title: parsed.title,
      slug,
      videoProvider: parsed.videoProvider,
      videoUrl: parsed.videoUrl,
      thumbnailUrl: parsed.thumbnailUrl,
      durationMins: parsed.durationMins ?? null,
      description: parsed.description,
      visibleToPublic: parsed.visibleToPublic,
      freeForEveryone: parsed.freeForEveryone,
      standalone: parsed.standalone,
      published: parsed.published,
      publishedAt: parsed.published ? new Date() : null,
      tags: tagIds.length > 0 ? { connect: tagIds.map((id) => ({ id })) } : undefined,
      categories:
        categoryIds.length > 0 ? { connect: categoryIds.map((id) => ({ id })) } : undefined,
    },
  });

  revalidatePath("/studio/classes");
  revalidatePath(`/${creator.slug}/practice`);
  redirect(`/studio/classes/${cls.id}?saved=class`);
}
