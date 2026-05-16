import Link from "next/link";
import { getCreatorForCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { FormCard } from "@/components/studio-form";
import { SeriesFormFields } from "../_form";
import { createSeriesAction } from "./actions";

export default async function NewSeriesPage() {
  const creator = (await getCreatorForCurrentUser())!;
  const [classes, tags, categories] = await Promise.all([
    db.class.findMany({ where: { creatorId: creator.id }, orderBy: { title: "asc" } }),
    db.tag.findMany({ where: { creatorId: creator.id }, orderBy: { name: "asc" } }),
    db.category.findMany({ where: { creatorId: creator.id }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="max-w-2xl space-y-6">
      <Link href="/studio/series" className="btn-quiet">← Back to series</Link>
      <header><h1 className="text-h1">New series</h1></header>
      <form action={createSeriesAction} className="space-y-5">
        <div className="flex items-center gap-3">
          <button type="submit" className="btn btn-primary">Save series</button>
          <Link href="/studio/series" className="btn-quiet">Cancel</Link>
        </div>
        <FormCard>
          <SeriesFormFields classes={classes} tags={tags} categories={categories} />
        </FormCard>
        <div className="flex items-center gap-3">
          <button type="submit" className="btn btn-primary">Save series</button>
          <Link href="/studio/series" className="btn-quiet">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
