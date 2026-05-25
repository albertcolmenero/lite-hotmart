"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCreatorForCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { STOREFRONT_THEME_IDS } from "@/lib/themes";

const schema = z.object({
  displayName: z.string().min(1).max(80),
  bio: z.string().max(5000).optional().nullable(),
  logoUrl: z.string().url().optional().nullable(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  fontPair: z.enum(["inter", "fraunces"]),
  themeId: z
    .enum(STOREFRONT_THEME_IDS as [string, ...string[]])
    .optional()
    .nullable(),
});

export async function updateBrandingAction(formData: FormData) {
  const creator = await getCreatorForCurrentUser();
  if (!creator) throw new Error("No creator");
  const parsed = schema.parse({
    displayName: formData.get("displayName"),
    bio: formData.get("bio") || null,
    logoUrl: formData.get("logoUrl") || null,
    accentColor: formData.get("accentColor"),
    fontPair: formData.get("fontPair"),
    themeId: formData.get("themeId") || null,
  });

  await db.creator.update({ where: { id: creator.id }, data: parsed });
  revalidatePath("/studio/branding");
  // Revalidate the storefront layout so the new logo shows up across all sub-routes.
  revalidatePath(`/${creator.slug}`, "layout");
  redirect("/studio/branding?saved=branding");
}
