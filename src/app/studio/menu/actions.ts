"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCreatorForCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { STOREFRONT_PAGE_KEYS } from "@/lib/storefront-pages";

const createSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("PAGE"),
    name: z.string().min(1).max(40),
    pageKey: z.enum(STOREFRONT_PAGE_KEYS as [string, ...string[]]),
  }),
  z.object({
    type: z.literal("CATEGORY"),
    name: z.string().min(1).max(40),
    categoryId: z.string().min(1),
  }),
  z.object({
    type: z.literal("FAVOURITES"),
    name: z.string().min(1).max(40),
  }),
]);

export async function createMenuItemAction(formData: FormData) {
  const creator = await getCreatorForCurrentUser();
  if (!creator) throw new Error("No creator");

  const rawType = String(formData.get("type") ?? "");
  const parsed = createSchema.parse({
    type: rawType,
    name: formData.get("name"),
    pageKey: formData.get("pageKey") || undefined,
    categoryId: formData.get("categoryId") || undefined,
  });

  if (parsed.type === "CATEGORY") {
    const cat = await db.category.findFirst({
      where: { id: parsed.categoryId, creatorId: creator.id },
    });
    if (!cat) throw new Error("Category not found");
  }

  const last = await db.menuItem.findFirst({
    where: { creatorId: creator.id },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  const nextPosition = (last?.position ?? -1) + 1;

  await db.menuItem.create({
    data: {
      creatorId: creator.id,
      name: parsed.name,
      type: parsed.type,
      pageKey: parsed.type === "PAGE" ? parsed.pageKey : null,
      categoryId: parsed.type === "CATEGORY" ? parsed.categoryId : null,
      position: nextPosition,
    },
  });

  revalidatePath("/studio/menu");
  revalidatePath(`/${creator.slug}`);
  redirect("/studio/menu?saved=menu");
}

export async function moveMenuItemAction(formData: FormData) {
  const creator = await getCreatorForCurrentUser();
  if (!creator) throw new Error("No creator");
  const id = String(formData.get("id") ?? "");
  const direction = String(formData.get("direction") ?? "");
  if (direction !== "up" && direction !== "down") throw new Error("Bad direction");

  const items = await db.menuItem.findMany({
    where: { creatorId: creator.id },
    orderBy: { position: "asc" },
  });
  const idx = items.findIndex((m) => m.id === id);
  if (idx === -1) throw new Error("Not found");
  const neighborIdx = direction === "up" ? idx - 1 : idx + 1;
  if (neighborIdx < 0 || neighborIdx >= items.length) {
    redirect("/studio/menu");
  }
  const a = items[idx];
  const b = items[neighborIdx];
  await db.$transaction([
    db.menuItem.update({ where: { id: a.id }, data: { position: b.position } }),
    db.menuItem.update({ where: { id: b.id }, data: { position: a.position } }),
  ]);

  revalidatePath("/studio/menu");
  revalidatePath(`/${creator.slug}`);
  redirect("/studio/menu");
}

export async function deleteMenuItemAction(formData: FormData) {
  const creator = await getCreatorForCurrentUser();
  if (!creator) throw new Error("No creator");
  const id = String(formData.get("id") ?? "");
  const existing = await db.menuItem.findFirst({
    where: { id, creatorId: creator.id },
  });
  if (!existing) throw new Error("Not found");
  await db.menuItem.delete({ where: { id } });
  revalidatePath("/studio/menu");
  revalidatePath(`/${creator.slug}`);
  redirect("/studio/menu?saved=deleted");
}
