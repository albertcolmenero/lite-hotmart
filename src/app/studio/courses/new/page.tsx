import Link from "next/link";
import { getCreatorForCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { FormCard } from "@/components/studio-form";
import { CourseFormFields } from "../_form";
import { createCourseAction } from "./actions";

export default async function NewCoursePage() {
  const creator = (await getCreatorForCurrentUser())!;
  const [classes, tags, categories] = await Promise.all([
    db.class.findMany({ where: { creatorId: creator.id }, orderBy: { title: "asc" } }),
    db.tag.findMany({ where: { creatorId: creator.id }, orderBy: { name: "asc" } }),
    db.category.findMany({ where: { creatorId: creator.id }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="max-w-2xl space-y-6">
      <Link href="/studio/courses" className="btn-quiet">← Back to courses</Link>
      <header><h1 className="text-h1">New course</h1></header>
      <form action={createCourseAction} className="space-y-5">
        <div className="flex items-center gap-3">
          <button type="submit" className="btn btn-primary">Save course</button>
          <Link href="/studio/courses" className="btn-quiet">Cancel</Link>
        </div>
        <FormCard>
          <CourseFormFields
            classes={classes}
            tags={tags}
            categories={categories}
            currency={creator.currency}
          />
        </FormCard>
        <div className="flex items-center gap-3">
          <button type="submit" className="btn btn-primary">Save course</button>
          <Link href="/studio/courses" className="btn-quiet">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
