import { cookies } from "next/headers";
import type { User } from "@prisma/client";

/** Cookie name holding the creator id a super admin is currently "viewing as". */
export const STUDIO_CREATOR_COOKIE = "lh_studio_creator";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

export function isSuperAdmin(user: Pick<User, "role"> | null | undefined): boolean {
  return user?.role === "super_admin";
}

export async function readActiveCreatorCookie(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(STUDIO_CREATOR_COOKIE)?.value ?? null;
}

export async function setActiveCreatorCookie(creatorId: string): Promise<void> {
  const jar = await cookies();
  jar.set(STUDIO_CREATOR_COOKIE, creatorId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
}

export async function clearActiveCreatorCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(STUDIO_CREATOR_COOKIE);
}
