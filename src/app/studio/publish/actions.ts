"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCreatorForCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function publishCreatorAction() {
  const creator = await getCreatorForCurrentUser();
  if (!creator) throw new Error("No creator");

  await db.creator.update({
    where: { id: creator.id },
    data: { published: true, publishedAt: new Date() },
  });

  revalidatePath("/studio");
  revalidatePath("/studio/publish");
  revalidatePath(`/${creator.slug}`);
  redirect("/studio/publish?saved=published");
}

export async function unpublishCreatorAction() {
  const creator = await getCreatorForCurrentUser();
  if (!creator) throw new Error("No creator");
  await db.creator.update({
    where: { id: creator.id },
    data: { published: false },
  });
  revalidatePath("/studio");
  revalidatePath("/studio/publish");
  revalidatePath(`/${creator.slug}`);
  redirect("/studio/publish?saved=unpublished");
}
