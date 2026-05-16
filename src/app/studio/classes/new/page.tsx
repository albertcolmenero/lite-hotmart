import Link from "next/link";
import { getCreatorForCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { FormCard } from "@/components/studio-form";
import { ClassFormFields } from "../_form";
import { createClassAction } from "./actions";

export default async function NewClassPage() {
  const creator = (await getCreatorForCurrentUser())!;
  const [tags, categories] = await Promise.all([
    db.tag.findMany({
      where: { creatorId: creator.id },
      orderBy: { name: "asc" },
    }),
    db.category.findMany({
      where: { creatorId: creator.id },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="max-w-2xl space-y-6">
      <Link href="/studio/classes" className="btn-quiet">← Back to classes</Link>
      <header>
        <h1 className="text-h1">New class</h1>
      </header>
      <form action={createClassAction} className="space-y-5">
        <div className="flex items-center gap-3">
          <button type="submit" className="btn btn-primary">Save class</button>
          <Link href="/studio/classes" className="btn-quiet">Cancel</Link>
        </div>
        <FormCard>
          <ClassFormFields tags={tags} categories={categories} />
        </FormCard>
        <div className="flex items-center gap-3">
          <button type="submit" className="btn btn-primary">Save class</button>
          <Link href="/studio/classes" className="btn-quiet">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
