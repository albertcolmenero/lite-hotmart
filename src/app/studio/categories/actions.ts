"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCreatorForCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { slugify, ensureUniqueSlug } from "@/lib/slug";

const createSchema = z.object({
  name: z.string().min(1).max(80),
});

export async function createCategoryAction(formData: FormData) {
  const creator = await getCreatorForCurrentUser();
  if (!creator) throw new Error("No creator");
  const parsed = createSchema.parse({ name: formData.get("name") });
  const slug = await ensureUniqueSlug(slugify(parsed.name), async (candidate) =>
    Boolean(
      await db.category.findUnique({
        where: { creatorId_slug: { creatorId: creator.id, slug: candidate } },
      }),
    ),
  );
  const created = await db.category.create({
    data: { creatorId: creator.id, name: parsed.name, slug },
  });
  revalidatePath("/studio/categories");
  revalidatePath("/studio/menu");
  redirect(`/studio/categories/${created.id}?saved=category`);
}

export async function deleteCategoryAction(formData: FormData) {
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
