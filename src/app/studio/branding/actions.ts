"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { getCreatorForCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { STOREFRONT_THEME_IDS } from "@/lib/themes";
import { parseHomeContent } from "@/lib/home-content";

// `bio` is intentionally NOT in this schema/update: the Bio textarea was replaced
// by the rich `homeContent` editor, so the form no longer submits a bio. Touching
// it here would clobber the stored value (still used as the home-page fallback).
const schema = z.object({
  displayName: z.string().min(1).max(80),
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
    logoUrl: formData.get("logoUrl") || null,
    accentColor: formData.get("accentColor"),
    fontPair: formData.get("fontPair"),
    themeId: formData.get("themeId") || null,
  });

  // Empty/invalid rich content clears the field; valid content is stored as-is.
  // Prisma 6 needs `Prisma.JsonNull` (not JS null) to write SQL NULL to a Json? column.
  const homeContent = parseHomeContent(formData.get("homeContent"));

  await db.creator.update({
    where: { id: creator.id },
    data: { ...parsed, homeContent: homeContent ?? Prisma.JsonNull },
  });
  revalidatePath("/studio/branding");
  // Revalidate the storefront layout so the new logo shows up across all sub-routes.
  revalidatePath(`/${creator.slug}`, "layout");
  redirect("/studio/branding?saved=branding");
}
