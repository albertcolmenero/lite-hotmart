"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCreatorForCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { slugify, ensureUniqueSlug } from "@/lib/slug";

const createSchema = z.object({
  name: z.string().min(1).max(60),
});

export async function createTagAction(formData: FormData) {
  const creator = await getCreatorForCurrentUser();
  if (!creator) throw new Error("No creator");
  const parsed = createSchema.parse({ name: formData.get("name") });
  const slug = await ensureUniqueSlug(
    slugify(parsed.name, 40),
    async (candidate) =>
      Boolean(
        await db.tag.findUnique({
          where: { creatorId_slug: { creatorId: creator.id, slug: candidate } },
        }),
      ),
    40,
  );
  await db.tag.create({
    data: { creatorId: creator.id, name: parsed.name, slug },
  });
  revalidatePath("/studio/tags");
  redirect("/studio/tags?saved=tag");
}

export async function deleteTagAction(formData: FormData) {
  const creator = await getCreatorForCurrentUser();
  if (!creator) throw new Error("No creator");
  const id = String(formData.get("id") ?? "");
  const t = await db.tag.findFirst({ where: { id, creatorId: creator.id } });
  if (!t) throw new Error("Not found");
  await db.tag.delete({ where: { id } });
  revalidatePath("/studio/tags");
  redirect("/studio/tags?saved=deleted");
}
