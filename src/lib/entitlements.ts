import { db } from "./db";

/**
 * V2 access logic — much simpler than V1.
 *
 *   - Subscription gives access to ALL Classes & Series for the creator (single Plan model).
 *   - One-time Course purchase gives access to that Course's Classes.
 *   - `freeForEveryone` short-circuits everything (free Classes/Series).
 *   - `visibleToPublic` controls catalog *visibility*, not access.
 */

export async function hasActiveSubscription(userId: string, creatorId: string): Promise<boolean> {
  if (!userId) return false;
  const now = new Date();
  const ent = await db.entitlement.findFirst({
    where: {
      userId,
      source: "subscription",
      creatorId,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
  });
  return Boolean(ent);
}

export async function hasCoursePurchase(userId: string, courseId: string): Promise<boolean> {
  if (!userId) return false;
  const now = new Date();
  const ent = await db.entitlement.findFirst({
    where: {
      userId,
      source: "purchase",
      courseId,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
  });
  return Boolean(ent);
}

export async function canPlayClass(params: {
  userId: string | null;
  classId: string;
}): Promise<{ allowed: boolean; reason?: "auth_required" | "paywall" | "not_found" }> {
  const cls = await db.class.findUnique({
    where: { id: params.classId },
    include: { courses: true },
  });
  if (!cls || !cls.published) return { allowed: false, reason: "not_found" };
  if (cls.freeForEveryone) return { allowed: true };
  if (!params.userId) return { allowed: false, reason: "auth_required" };

  // Active subscription on this creator → grants all classes (incl. course classes)
  if (await hasActiveSubscription(params.userId, cls.creatorId)) return { allowed: true };

  // OR: course-specific purchase covers classes that belong to that course
  for (const cc of cls.courses) {
    if (await hasCoursePurchase(params.userId, cc.courseId)) return { allowed: true };
  }
  return { allowed: false, reason: "paywall" };
}

export async function canPlaySeries(params: {
  userId: string | null;
  seriesId: string;
}): Promise<{ allowed: boolean; reason?: "auth_required" | "paywall" | "not_found" }> {
  const s = await db.series.findUnique({ where: { id: params.seriesId } });
  if (!s || !s.published) return { allowed: false, reason: "not_found" };
  if (s.freeForEveryone) return { allowed: true };
  if (!params.userId) return { allowed: false, reason: "auth_required" };
  if (await hasActiveSubscription(params.userId, s.creatorId)) return { allowed: true };
  return { allowed: false, reason: "paywall" };
}

export async function canPlayCourse(params: {
  userId: string | null;
  courseId: string;
}): Promise<{ allowed: boolean; reason?: "auth_required" | "paywall" | "not_found" }> {
  const c = await db.course.findUnique({ where: { id: params.courseId } });
  if (!c || !c.published) return { allowed: false, reason: "not_found" };
  if (!params.userId) return { allowed: false, reason: "auth_required" };
  if (await hasCoursePurchase(params.userId, c.id)) return { allowed: true };
  // Subscribers do NOT automatically get courses (per product decision).
  return { allowed: false, reason: "paywall" };
}

/** True if we should *list* this resource for a non-subscriber on the catalog. */
export function isVisibleInCatalog(opts: {
  visibleToPublic: boolean;
  isSubscriber: boolean;
}): boolean {
  if (opts.isSubscriber) return true;
  return opts.visibleToPublic;
}
