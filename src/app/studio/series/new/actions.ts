"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCreatorForCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { slugify, ensureUniqueSlug } from "@/lib/slug";

const schema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional().nullable(),
  coverUrl: z.string().url().optional().nullable(),
  visibleToPublic: z.boolean(),
  freeForEveryone: z.boolean(),
  published: z.boolean(),
});

export async function createSeriesAction(formData: FormData) {
  const creator = await getCreatorForCurrentUser();
  if (!creator) throw new Error("No creator");

  const parsed = schema.parse({
    title: formData.get("title"),
    description: formData.get("description") || null,
    coverUrl: formData.get("coverUrl") || null,
    visibleToPublic: formData.get("visibleToPublic") === "on",
    freeForEveryone: formData.get("freeForEveryone") === "on",
    published: formData.get("published") === "on",
  });

  const slug = await ensureUniqueSlug(slugify(parsed.title), async (candidate) =>
    Boolean(
      await db.series.findUnique({
        where: { creatorId_slug: { creatorId: creator.id, slug: candidate } },
      }),
    ),
  );

  const orderedAll = formData.getAll("classOrder").map(String);
  const checked = new Set(formData.getAll("classIds").map(String));
  const orderedClassIds = orderedAll.filter((id) => checked.has(id));
  const tagIds = formData.getAll("tagIds").map(String);
  const categoryIds = formData.getAll("categoryIds").map(String);

  const series = await db.series.create({
    data: {
      creatorId: creator.id,
      title: parsed.title,
      slug,
      description: parsed.description,
      coverUrl: parsed.coverUrl,
      visibleToPublic: parsed.visibleToPublic,
      freeForEveryone: parsed.freeForEveryone,
      published: parsed.published,
      publishedAt: parsed.published ? new Date() : null,
      tags: tagIds.length > 0 ? { connect: tagIds.map((id) => ({ id })) } : undefined,
      categories:
        categoryIds.length > 0 ? { connect: categoryIds.map((id) => ({ id })) } : undefined,
      classes: {
        create: orderedClassIds.map((classId, i) => ({ classId, position: i })),
      },
    },
  });

  revalidatePath("/studio/series");
  revalidatePath(`/${creator.slug}/practice`);
  redirect(`/studio/series/${series.id}?saved=series`);
}
