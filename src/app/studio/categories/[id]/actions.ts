"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCreatorForCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

const schema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(80),
  description: z.string().optional().nullable(),
});

export async function updateCategoryAction(formData: FormData) {
  const creator = await getCreatorForCurrentUser();
  if (!creator) throw new Error("No creator");

  const parsed = schema.parse({
    id: formData.get("id"),
    name: formData.get("name"),
    description: formData.get("description") || null,
  });

  const existing = await db.category.findFirst({
    where: { id: parsed.id, creatorId: creator.id },
  });
  if (!existing) throw new Error("Not found");

  const classIds = formData.getAll("classIds").map(String);
  const seriesIds = formData.getAll("seriesIds").map(String);
  const courseIds = formData.getAll("courseIds").map(String);

  await db.category.update({
    where: { id: parsed.id },
    data: {
      name: parsed.name,
      description: parsed.description,
      classes: { set: classIds.map((id) => ({ id })) },
      series: { set: seriesIds.map((id) => ({ id })) },
      courses: { set: courseIds.map((id) => ({ id })) },
    },
  });

  revalidatePath("/studio/categories");
  revalidatePath(`/studio/categories/${parsed.id}`);
  revalidatePath("/studio/menu");
  revalidatePath(`/${creator.slug}`);
  revalidatePath(`/${creator.slug}/category/${existing.slug}`);
  redirect(`/studio/categories/${parsed.id}?saved=category`);
}

export async function deleteCategoryFromEditAction(formData: FormData) {
  const creator = await getCreatorForCurrentUser();
  if (!creator) throw new Error("No creator");
  const id = String(formData.get("id") ?? "");
  const existing = await db.category.findFirst({
    where: { id, creatorId: creator.id },
  });
  if (!existing) throw new Error("Not found");
  await db.category.delete({ where: { id } });
  revalidatePath("/studio/categories");
  revalidatePath("/studio/menu");
  revalidatePath(`/${creator.slug}`);
  revalidatePath(`/${creator.slug}/category/${existing.slug}`);
  redirect("/studio/categories?saved=deleted");
}
