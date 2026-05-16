"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCreatorForCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { syncCourseToStripe, archiveStripeCourse } from "@/lib/stripe-sync";

const schema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(200),
  eyebrow: z.string().max(80).optional().nullable(),
  description: z.string().optional().nullable(),
  coverUrl: z.string().url().optional().nullable(),
  priceDollars: z.coerce.number().nonnegative(),
  visibleToPublic: z.boolean(),
  published: z.boolean(),
});

export async function updateCourseAction(formData: FormData) {
  const creator = await getCreatorForCurrentUser();
  if (!creator) throw new Error("No creator");

  const parsed = schema.parse({
    id: formData.get("id"),
    title: formData.get("title"),
    eyebrow: formData.get("eyebrow") || null,
    description: formData.get("description") || null,
    coverUrl: formData.get("coverUrl") || null,
    priceDollars: formData.get("priceDollars"),
    visibleToPublic: formData.get("visibleToPublic") === "on",
    published: formData.get("published") === "on",
  });

  const existing = await db.course.findFirst({ where: { id: parsed.id, creatorId: creator.id } });
  if (!existing) throw new Error("Not found");

  const orderedAll = formData.getAll("classOrder").map(String);
  const checked = new Set(formData.getAll("classIds").map(String));
  const orderedClassIds = orderedAll.filter((id) => checked.has(id));
  const tagIds = formData.getAll("tagIds").map(String);
  const categoryIds = formData.getAll("categoryIds").map(String);
  const becomingPublished = parsed.published && !existing.published;

  await db.$transaction([
    db.course.update({
      where: { id: parsed.id },
      data: {
        title: parsed.title,
        eyebrow: parsed.eyebrow,
        description: parsed.description,
        coverUrl: parsed.coverUrl,
        priceCents: Math.round(parsed.priceDollars * 100),
        visibleToPublic: parsed.visibleToPublic,
        published: parsed.published,
        publishedAt: becomingPublished ? new Date() : existing.publishedAt,
        tags: { set: tagIds.map((id) => ({ id })) },
        categories: { set: categoryIds.map((id) => ({ id })) },
      },
    }),
    db.courseClass.deleteMany({ where: { courseId: parsed.id } }),
    ...(orderedClassIds.length > 0
      ? [
          db.courseClass.createMany({
            data: orderedClassIds.map((classId, i) => ({
              courseId: parsed.id,
              classId,
              position: i,
            })),
          }),
        ]
      : []),
  ]);

  const fresh = await db.course.findUnique({ where: { id: parsed.id } });
  if (fresh) {
    try {
      await syncCourseToStripe(creator, fresh);
    } catch (err) {
      console.error("[course-sync] update sync failed", err);
    }
  }

  revalidatePath("/studio/courses");
  revalidatePath(`/studio/courses/${parsed.id}`);
  revalidatePath(`/${creator.slug}/courses`);
  revalidatePath(`/${creator.slug}/courses/${existing.slug}`);
  redirect(`/studio/courses/${parsed.id}?saved=course`);
}

export async function deleteCourseAction(formData: FormData) {
  const creator = await getCreatorForCurrentUser();
  if (!creator) throw new Error("No creator");
  const id = String(formData.get("id") ?? "");
  const existing = await db.course.findFirst({ where: { id, creatorId: creator.id } });
  if (!existing) throw new Error("Not found");
  try {
    await archiveStripeCourse(creator, existing);
  } catch (err) {
    console.error("[course-sync] archive failed", err);
  }
  await db.course.delete({ where: { id } });
  revalidatePath("/studio/courses");
  revalidatePath(`/${creator.slug}/courses`);
  redirect("/studio/courses?saved=deleted");
}
