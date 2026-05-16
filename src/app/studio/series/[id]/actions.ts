"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCreatorForCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

const schema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().optional().nullable(),
  coverUrl: z.string().url().optional().nullable(),
  visibleToPublic: z.boolean(),
  freeForEveryone: z.boolean(),
  published: z.boolean(),
});

export async function updateSeriesAction(formData: FormData) {
  const creator = await getCreatorForCurrentUser();
  if (!creator) throw new Error("No creator");

  const parsed = schema.parse({
    id: formData.get("id"),
    title: formData.get("title"),
    description: formData.get("description") || null,
    coverUrl: formData.get("coverUrl") || null,
    visibleToPublic: formData.get("visibleToPublic") === "on",
    freeForEveryone: formData.get("freeForEveryone") === "on",
    published: formData.get("published") === "on",
  });

  const existing = await db.series.findFirst({ where: { id: parsed.id, creatorId: creator.id } });
  if (!existing) throw new Error("Not found");

  const orderedAll = formData.getAll("classOrder").map(String);
  const checked = new Set(formData.getAll("classIds").map(String));
  const orderedClassIds = orderedAll.filter((id) => checked.has(id));
  const tagIds = formData.getAll("tagIds").map(String);
  const categoryIds = formData.getAll("categoryIds").map(String);
  const becomingPublished = parsed.published && !existing.published;

  await db.$transaction([
    db.series.update({
      where: { id: parsed.id },
      data: {
        title: parsed.title,
        description: parsed.description,
        coverUrl: parsed.coverUrl,
        visibleToPublic: parsed.visibleToPublic,
        freeForEveryone: parsed.freeForEveryone,
        published: parsed.published,
        publishedAt: becomingPublished ? new Date() : existing.publishedAt,
        tags: { set: tagIds.map((id) => ({ id })) },
        categories: { set: categoryIds.map((id) => ({ id })) },
      },
    }),
    db.seriesClass.deleteMany({ where: { seriesId: parsed.id } }),
    ...(orderedClassIds.length > 0
      ? [
          db.seriesClass.createMany({
            data: orderedClassIds.map((classId, i) => ({
              seriesId: parsed.id,
              classId,
              position: i,
            })),
          }),
        ]
      : []),
  ]);

  revalidatePath("/studio/series");
  revalidatePath(`/studio/series/${parsed.id}`);
  revalidatePath(`/${creator.slug}/practice`);
  revalidatePath(`/${creator.slug}/practice/series/${existing.slug}`);
  redirect(`/studio/series/${parsed.id}?saved=series`);
}

export async function deleteSeriesAction(formData: FormData) {
  const creator = await getCreatorForCurrentUser();
  if (!creator) throw new Error("No creator");
  const id = String(formData.get("id") ?? "");
  const existing = await db.series.findFirst({ where: { id, creatorId: creator.id } });
  if (!existing) throw new Error("Not found");
  await db.series.delete({ where: { id } });
  revalidatePath("/studio/series");
  revalidatePath(`/${creator.slug}/practice`);
  redirect("/studio/series?saved=deleted");
}
