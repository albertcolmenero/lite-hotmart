import { notFound } from "next/navigation";
import Link from "next/link";
import { getCreatorForCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { FormCard } from "@/components/studio-form";
import { ClassFormFields } from "../_form";
import { updateClassAction, deleteClassAction } from "./actions";

export default async function ClassEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const creator = (await getCreatorForCurrentUser())!;
  const [cls, tags, categories] = await Promise.all([
    db.class.findFirst({
      where: { id, creatorId: creator.id },
      include: { tags: true, categories: { select: { id: true } } },
    }),
    db.tag.findMany({ where: { creatorId: creator.id }, orderBy: { name: "asc" } }),
    db.category.findMany({
      where: { creatorId: creator.id },
      orderBy: { name: "asc" },
    }),
  ]);
  if (!cls) notFound();

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/studio/classes" className="btn-quiet">← Back to classes</Link>
        <Link
          href={`/${creator.slug}/practice/classes/${cls.slug}`}
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
            style={{ color: cls.published ? "var(--moss)" : "var(--lichen)" }}
          >
            <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: "currentColor" }} />
            {cls.published ? "Published" : "Draft"}
          </span>
          <span style={{ color: "var(--bone)" }}>·</span>
          <span className="text-mono-sm">/{creator.slug}/practice/classes/{cls.slug}</span>
        </div>
        <h1 className="text-h1 mt-2">{cls.title}</h1>
      </header>

      <form action={updateClassAction} className="space-y-5">
        <input type="hidden" name="id" value={cls.id} />
        <div className="flex items-center gap-3">
          <button type="submit" className="btn btn-primary">Save changes</button>
          <Link href="/studio/classes" className="btn-quiet">Cancel</Link>
        </div>
        <FormCard>
          <ClassFormFields
            tags={tags}
            categories={categories}
            defaults={{
              title: cls.title,
              description: cls.description,
              videoProvider: cls.videoProvider,
              videoUrl: cls.videoUrl,
              thumbnailUrl: cls.thumbnailUrl,
              durationMins: cls.durationMins,
              visibleToPublic: cls.visibleToPublic,
              freeForEveryone: cls.freeForEveryone,
              standalone: cls.standalone,
              published: cls.published,
              tagIds: cls.tags.map((t) => t.id),
              categoryIds: cls.categories.map((c) => c.id),
            }}
          />
        </FormCard>
        <div className="flex items-center gap-3">
          <button type="submit" className="btn btn-primary">Save changes</button>
          <Link href="/studio/classes" className="btn-quiet">Cancel</Link>
        </div>
      </form>

      <div className="pt-6" style={{ borderTop: "1px solid var(--bone)" }}>
        <h2 className="text-sm font-medium" style={{ color: "var(--rust)" }}>Danger zone</h2>
        <form action={deleteClassAction} className="mt-2">
          <input type="hidden" name="id" value={cls.id} />
          <button
            type="submit"
            className="text-sm hover:underline"
            style={{ color: "var(--rust)", textUnderlineOffset: 3 }}
          >
            Delete this class
          </button>
        </form>
      </div>
    </div>
  );
}
