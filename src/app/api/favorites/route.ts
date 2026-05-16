import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireDbUser } from "@/lib/auth";

const schema = z.object({
  resourceType: z.enum(["class", "series", "course"]),
  resourceId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireDbUser();
    const { resourceType, resourceId } = schema.parse(await req.json());

    const where =
      resourceType === "class"
        ? { userId_classId: { userId: user.id, classId: resourceId } }
        : resourceType === "series"
          ? { userId_seriesId: { userId: user.id, seriesId: resourceId } }
          : { userId_courseId: { userId: user.id, courseId: resourceId } };

    const existing = await db.favorite.findUnique({ where });
    if (existing) {
      await db.favorite.delete({ where: { id: existing.id } });
      return NextResponse.json({ favorited: false });
    }
    await db.favorite.create({
      data: {
        userId: user.id,
        classId: resourceType === "class" ? resourceId : null,
        seriesId: resourceType === "series" ? resourceId : null,
        courseId: resourceType === "course" ? resourceId : null,
      },
    });
    return NextResponse.json({ favorited: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
