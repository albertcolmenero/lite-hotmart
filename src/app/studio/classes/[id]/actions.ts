"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCreatorForCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

const schema = z.object({
  id: z.string().min(1),
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

export async function updateClassAction(formData: FormData) {
  const creator = await getCreatorForCurrentUser();
  if (!creator) throw new Error("No creator");

  const parsed = schema.parse({
    id: formData.get("id"),
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

  const existing = await db.class.findFirst({ where: { id: parsed.id, creatorId: creator.id } });
  if (!existing) throw new Error("Not found");

  const tagIds = formData.getAll("tagIds").map(String);
  const categoryIds = formData.getAll("categoryIds").map(String);
  const becomingPublished = parsed.published && !existing.published;

  await db.class.update({
    where: { id: parsed.id },
    data: {
      title: parsed.title,
      videoProvider: parsed.videoProvider,
      videoUrl: parsed.videoUrl,
      thumbnailUrl: parsed.thumbnailUrl,
      durationMins: parsed.durationMins ?? null,
      description: parsed.description,
      visibleToPublic: parsed.visibleToPublic,
      freeForEveryone: parsed.freeForEveryone,
      standalone: parsed.standalone,
      published: parsed.published,
      publishedAt: becomingPublished ? new Date() : existing.publishedAt,
      tags: { set: tagIds.map((id) => ({ id })) },
      categories: { set: categoryIds.map((id) => ({ id })) },
    },
  });

  revalidatePath("/studio/classes");
  revalidatePath(`/studio/classes/${parsed.id}`);
  revalidatePath(`/${creator.slug}/practice`);
  revalidatePath(`/${creator.slug}/practice/classes/${existing.slug}`);
  redirect(`/studio/classes/${parsed.id}?saved=class`);
}

export async function deleteClassAction(formData: FormData) {
  const creator = await getCreatorForCurrentUser();
  if (!creator) throw new Error("No creator");
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("id required");

  const existing = await db.class.findFirst({ where: { id, creatorId: creator.id } });
  if (!existing) throw new Error("Not found");

  await db.class.delete({ where: { id } });
  revalidatePath("/studio/classes");
  revalidatePath(`/${creator.slug}/practice`);
  redirect("/studio/classes?saved=deleted");
}
