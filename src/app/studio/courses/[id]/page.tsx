import { notFound } from "next/navigation";
import Link from "next/link";
import { getCreatorForCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { FormCard } from "@/components/studio-form";
import { CourseFormFields } from "../_form";
import { updateCourseAction, deleteCourseAction } from "./actions";

export default async function CourseEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const creator = (await getCreatorForCurrentUser())!;
  const [course, classes, tags, categories] = await Promise.all([
    db.course.findFirst({
      where: { id, creatorId: creator.id },
      include: {
        tags: true,
        categories: { select: { id: true } },
        classes: { orderBy: { position: "asc" } },
      },
    }),
    db.class.findMany({ where: { creatorId: creator.id }, orderBy: { title: "asc" } }),
    db.tag.findMany({ where: { creatorId: creator.id }, orderBy: { name: "asc" } }),
    db.category.findMany({ where: { creatorId: creator.id }, orderBy: { name: "asc" } }),
  ]);
  if (!course) notFound();

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/studio/courses" className="btn-quiet">← Back to courses</Link>
        <Link
          href={`/${creator.slug}/courses/${course.slug}`}
          target="_blank"
          className="btn-quiet"
        >
          View public page →
        </Link>
      </div>
      <header>
        <div className="flex items-center gap-2 text-sm" style={{ color: "var(--lichen)" }}>
          <span
            className="inline-flex items-center gap-1.5"
            style={{ color: course.published ? "var(--moss)" : "var(--lichen)" }}
          >
            <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: "currentColor" }} />
            {course.published ? "Published" : "Draft"}
          </span>
        </div>
        <h1 className="text-h1 mt-2">{course.title}</h1>
      </header>
      <form action={updateCourseAction} className="space-y-5">
        <input type="hidden" name="id" value={course.id} />
        <div className="flex items-center gap-3">
          <button type="submit" className="btn btn-primary">Save changes</button>
          <Link href="/studio/courses" className="btn-quiet">Cancel</Link>
        </div>
        <FormCard>
          <CourseFormFields
            classes={classes}
            tags={tags}
            categories={categories}
            currency={creator.currency}
            defaults={{
              title: course.title,
              eyebrow: course.eyebrow,
              description: course.description,
              coverUrl: course.coverUrl,
              priceDollars: course.priceCents / 100,
              visibleToPublic: course.visibleToPublic,
              published: course.published,
              classIds: course.classes.map((c) => c.classId),
              tagIds: course.tags.map((t) => t.id),
              categoryIds: course.categories.map((c) => c.id),
            }}
          />
        </FormCard>
        <div className="flex items-center gap-3">
          <button type="submit" className="btn btn-primary">Save changes</button>
          <Link href="/studio/courses" className="btn-quiet">Cancel</Link>
        </div>
      </form>

      <div className="pt-6" style={{ borderTop: "1px solid var(--bone)" }}>
        <h2 className="text-sm font-medium" style={{ color: "var(--rust)" }}>Danger zone</h2>
        <form action={deleteCourseAction} className="mt-2">
          <input type="hidden" name="id" value={course.id} />
          <button
            type="submit"
            className="text-sm hover:underline"
            style={{ color: "var(--rust)", textUnderlineOffset: 3 }}
          >
            Delete this course
          </button>
        </form>
      </div>
    </div>
  );
}
