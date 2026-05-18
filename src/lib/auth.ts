import { db } from "./db";
import { DEV_CLERK_ID, DEV_EMAIL, DEV_NAME, IS_DEV_BYPASS } from "./dev-auth";
import {
  clearActiveCreatorCookie,
  isSuperAdmin,
  readActiveCreatorCookie,
} from "./super-admin";

async function currentClerkUserId(): Promise<string | null> {
  if (IS_DEV_BYPASS) return DEV_CLERK_ID;
  // Lazy-import Clerk so this module works even when Clerk env vars are absent
  // in dev-bypass mode.
  const { auth } = await import("@clerk/nextjs/server");
  const { userId } = await auth();
  return userId;
}

async function currentClerkUserProfile(): Promise<{
  email: string;
  name: string | null;
  imageUrl: string | null;
} | null> {
  if (IS_DEV_BYPASS) {
    return { email: DEV_EMAIL, name: DEV_NAME, imageUrl: null };
  }
  const { currentUser } = await import("@clerk/nextjs/server");
  const cu = await currentUser();
  if (!cu) return null;
  const email = cu.emailAddresses[0]?.emailAddress;
  if (!email) return null;
  return {
    email,
    name: [cu.firstName, cu.lastName].filter(Boolean).join(" ") || null,
    imageUrl: cu.imageUrl ?? null,
  };
}

/**
 * Returns the local DB User for the currently authed Clerk user, creating
 * it on the fly if it doesn't exist yet (covers the case where the Clerk
 * webhook hasn't fired yet, and the dev-bypass case).
 */
export async function getOrCreateDbUser() {
  const clerkId = await currentClerkUserId();
  if (!clerkId) return null;

  const existing = await db.user.findUnique({ where: { clerkId } });
  if (existing) return existing;

  const profile = await currentClerkUserProfile();
  if (!profile) return null;

  return db.user.create({
    data: {
      clerkId,
      email: profile.email,
      name: profile.name,
      imageUrl: profile.imageUrl,
    },
  });
}

export async function requireDbUser() {
  const user = await getOrCreateDbUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

/**
 * Returns the creator the current viewer should operate on. For regular users
 * that's always their own creator. For super admins, this respects the
 * `lh_studio_creator` cookie so they can "view as" another publisher.
 *
 * If the cookie points at a creator that doesn't exist (or the viewer is no
 * longer super admin), the cookie is silently cleared and we fall back to the
 * user's own creator.
 */
export async function getActiveCreator() {
  const user = await getOrCreateDbUser();
  if (!user) return null;

  if (isSuperAdmin(user)) {
    const targetId = await readActiveCreatorCookie();
    if (targetId) {
      const target = await db.creator.findUnique({ where: { id: targetId } });
      if (target) return target;
      // Stale cookie — clean up so we don't keep re-checking a ghost id.
      await clearActiveCreatorCookie();
    }
  }

  return db.creator.findUnique({ where: { userId: user.id } });
}

/**
 * @deprecated kept as an alias so existing imports continue to work.
 * Prefer `getActiveCreator()` for new code.
 */
export const getCreatorForCurrentUser = getActiveCreator;

/** Re-export so route handlers can read the clerk id without importing Clerk directly. */
export { currentClerkUserId };
