import { notFound } from "next/navigation";
import Link from "next/link";
import { getCreatorForCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { FormCard } from "@/components/studio-form";
import { SeriesFormFields } from "../_form";
import { updateSeriesAction, deleteSeriesAction } from "./actions";

export default async function SeriesEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const creator = (await getCreatorForCurrentUser())!;
  const [series, classes, tags, categories] = await Promise.all([
    db.series.findFirst({
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
  if (!series) notFound();

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/studio/series" className="btn-quiet">← Back to series</Link>
        <Link
          href={`/${creator.slug}/practice/series/${series.slug}`}
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
            style={{ color: series.published ? "var(--moss)" : "var(--lichen)" }}
          >
            <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: "currentColor" }} />
            {series.published ? "Published" : "Draft"}
          </span>
        </div>
        <h1 className="text-h1 mt-2">{series.title}</h1>
      </header>
      <form action={updateSeriesAction} className="space-y-5">
        <input type="hidden" name="id" value={series.id} />
        <div className="flex items-center gap-3">
          <button type="submit" className="btn btn-primary">Save changes</button>
          <Link href="/studio/series" className="btn-quiet">Cancel</Link>
        </div>
        <FormCard>
          <SeriesFormFields
            classes={classes}
            tags={tags}
            categories={categories}
            defaults={{
              title: series.title,
              description: series.description,
              coverUrl: series.coverUrl,
              visibleToPublic: series.visibleToPublic,
              freeForEveryone: series.freeForEveryone,
              published: series.published,
              classIds: series.classes.map((c) => c.classId),
              tagIds: series.tags.map((t) => t.id),
              categoryIds: series.categories.map((c) => c.id),
            }}
          />
        </FormCard>
        <div className="flex items-center gap-3">
          <button type="submit" className="btn btn-primary">Save changes</button>
          <Link href="/studio/series" className="btn-quiet">Cancel</Link>
        </div>
      </form>

      <div className="pt-6" style={{ borderTop: "1px solid var(--bone)" }}>
        <h2 className="text-sm font-medium" style={{ color: "var(--rust)" }}>Danger zone</h2>
        <form action={deleteSeriesAction} className="mt-2">
          <input type="hidden" name="id" value={series.id} />
          <button
            type="submit"
            className="text-sm hover:underline"
            style={{ color: "var(--rust)", textUnderlineOffset: 3 }}
          >
            Delete this series
          </button>
        </form>
      </div>
    </div>
  );
}
