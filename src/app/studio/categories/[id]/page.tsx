import Link from "next/link";
import { notFound } from "next/navigation";
import { getCreatorForCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { FormCard } from "@/components/studio-form";
import { CategoryFormFields } from "../_form";
import {
  updateCategoryAction,
  deleteCategoryFromEditAction,
} from "./actions";

export default async function CategoryEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const creator = (await getCreatorForCurrentUser())!;
  const [category, classes, series, courses] = await Promise.all([
    db.category.findFirst({
      where: { id, creatorId: creator.id },
      include: {
        classes: { select: { id: true } },
        series: { select: { id: true } },
        courses: { select: { id: true } },
      },
    }),
    db.class.findMany({
      where: { creatorId: creator.id },
      orderBy: { title: "asc" },
    }),
    db.series.findMany({
      where: { creatorId: creator.id },
      orderBy: { title: "asc" },
    }),
    db.course.findMany({
      where: { creatorId: creator.id },
      orderBy: { title: "asc" },
    }),
  ]);
  if (!category) notFound();

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/studio/categories" className="btn-quiet">
          ← Back to categories
        </Link>
        <Link
          href={`/${creator.slug}/category/${category.slug}`}
          target="_blank"
          className="btn-quiet"
        >
          View public page →
        </Link>
      </div>
      <header>
        <h1 className="text-h1">{category.name}</h1>
      </header>
      <form action={updateCategoryAction} className="space-y-5">
        <input type="hidden" name="id" value={category.id} />
        <div className="flex items-center gap-3">
          <button type="submit" className="btn btn-primary">
            Save changes
          </button>
          <Link href="/studio/categories" className="btn-quiet">
            Cancel
          </Link>
        </div>
        <FormCard>
          <CategoryFormFields
            classes={classes}
            series={series}
            courses={courses}
            defaults={{
              name: category.name,
              description: category.description,
              classIds: category.classes.map((c) => c.id),
              seriesIds: category.series.map((s) => s.id),
              courseIds: category.courses.map((c) => c.id),
            }}
          />
        </FormCard>
        <div className="flex items-center gap-3">
          <button type="submit" className="btn btn-primary">
            Save changes
          </button>
          <Link href="/studio/categories" className="btn-quiet">
            Cancel
          </Link>
        </div>
      </form>

      <div
        className="pt-6"
        style={{ borderTop: "1px solid var(--bone)" }}
      >
        <h2 className="text-sm font-medium" style={{ color: "var(--rust)" }}>
          Danger zone
        </h2>
        <form action={deleteCategoryFromEditAction} className="mt-2">
          <input type="hidden" name="id" value={category.id} />
          <button
            type="submit"
            className="text-sm hover:underline"
            style={{ color: "var(--rust)", textUnderlineOffset: 3 }}
          >
            Delete this category
          </button>
        </form>
      </div>
    </div>
  );
}
