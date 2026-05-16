"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireDbUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { seedDefaultMenuItems } from "@/lib/menu";

const schema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{3,30}$/),
  displayName: z.string().min(1).max(80),
  bio: z.string().max(280).optional().nullable(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export async function createCreatorAction(formData: FormData) {
  const user = await requireDbUser();

  const parsed = schema.parse({
    slug: formData.get("slug"),
    displayName: formData.get("displayName"),
    bio: formData.get("bio") || null,
    accentColor: formData.get("accentColor"),
  });

  // Check slug uniqueness — Prisma unique constraint will also catch this.
  const taken = await db.creator.findUnique({ where: { slug: parsed.slug } });
  if (taken) throw new Error("That URL is already taken.");

  const creator = await db.creator.create({
    data: {
      userId: user.id,
      slug: parsed.slug,
      displayName: parsed.displayName,
      bio: parsed.bio ?? null,
      accentColor: parsed.accentColor,
    },
  });

  await seedDefaultMenuItems(creator.id);

  redirect("/studio");
}
