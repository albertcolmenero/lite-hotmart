"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getOrCreateDbUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  clearActiveCreatorCookie,
  isSuperAdmin,
  setActiveCreatorCookie,
} from "@/lib/super-admin";

/**
 * Super-admin only. Sets the active-creator cookie so subsequent studio
 * requests resolve to the chosen creator. Anyone else calling this is
 * silently bounced (we never reveal the existence of the impersonation
 * mechanism to non-admins).
 */
export async function switchToCreatorAction(formData: FormData) {
  const user = await getOrCreateDbUser();
  if (!user || !isSuperAdmin(user)) {
    redirect("/studio");
  }

  const creatorId = String(formData.get("creatorId") ?? "");
  if (!creatorId) {
    redirect("/studio");
  }

  const target = await db.creator.findUnique({ where: { id: creatorId } });
  if (!target) {
    redirect("/studio");
  }

  await setActiveCreatorCookie(creatorId);
  revalidatePath("/studio", "layout");
  redirect("/studio");
}

/** Super-admin only. Clears the impersonation cookie. */
export async function exitImpersonationAction() {
  const user = await getOrCreateDbUser();
  if (!user || !isSuperAdmin(user)) {
    redirect("/studio");
  }
  await clearActiveCreatorCookie();
  revalidatePath("/studio", "layout");
  redirect("/studio");
}
