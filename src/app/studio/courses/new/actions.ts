"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCreatorForCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { slugify, ensureUniqueSlug } from "@/lib/slug";
import { syncCourseToStripe } from "@/lib/stripe-sync";

const schema = z.object({
  title: z.string().min(1).max(200),
  eyebrow: z.string().max(80).optional().nullable(),
  description: z.string().optional().nullable(),
  coverUrl: z.string().url().optional().nullable(),
  priceDollars: z.coerce.number().nonnegative(),
  visibleToPublic: z.boolean(),
  published: z.boolean(),
});

export async function createCourseAction(formData: FormData) {
  const creator = await getCreatorForCurrentUser();
  if (!creator) throw new Error("No creator");

  const parsed = schema.parse({
    title: formData.get("title"),
    eyebrow: formData.get("eyebrow") || null,
    description: formData.get("description") || null,
    coverUrl: formData.get("coverUrl") || null,
    priceDollars: formData.get("priceDollars"),
    visibleToPublic: formData.get("visibleToPublic") === "on",
    published: formData.get("published") === "on",
  });

  const slug = await ensureUniqueSlug(slugify(parsed.title), async (candidate) =>
    Boolean(
      await db.course.findUnique({
        where: { creatorId_slug: { creatorId: creator.id, slug: candidate } },
      }),
    ),
  );

  const orderedAll = formData.getAll("classOrder").map(String);
  const checked = new Set(formData.getAll("classIds").map(String));
  const orderedClassIds = orderedAll.filter((id) => checked.has(id));
  const tagIds = formData.getAll("tagIds").map(String);
  const categoryIds = formData.getAll("categoryIds").map(String);

  const course = await db.course.create({
    data: {
      creatorId: creator.id,
      title: parsed.title,
      slug,
      eyebrow: parsed.eyebrow,
      description: parsed.description,
      coverUrl: parsed.coverUrl,
      priceCents: Math.round(parsed.priceDollars * 100),
      currency: "usd",
      visibleToPublic: parsed.visibleToPublic,
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

  try {
    await syncCourseToStripe(creator, course);
  } catch (err) {
    console.error("[course-sync] new course sync failed", err);
  }

  revalidatePath("/studio/courses");
  revalidatePath(`/${creator.slug}/courses`);
  redirect(`/studio/courses/${course.id}?saved=course`);
}
