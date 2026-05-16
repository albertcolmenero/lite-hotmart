import type { Class, Course, Series } from "@prisma/client";
import { Field } from "@/components/studio-form";

export function CategoryFormFields({
  classes,
  series,
  courses,
  defaults,
}: {
  classes: Class[];
  series: Series[];
  courses: Course[];
  defaults?: {
    name?: string;
    description?: string | null;
    classIds?: string[];
    seriesIds?: string[];
    courseIds?: string[];
  };
}) {
  const checkedClassIds = new Set(defaults?.classIds ?? []);
  const checkedSeriesIds = new Set(defaults?.seriesIds ?? []);
  const checkedCourseIds = new Set(defaults?.courseIds ?? []);

  return (
    <>
      <Field label="Name">
        <input
          name="name"
          required
          defaultValue={defaults?.name ?? ""}
          className="input"
          style={{ fontSize: "1.0625rem", fontWeight: 500 }}
        />
      </Field>
      <Field label="Description" hint="Shown on the category page">
        <textarea
          name="description"
          rows={3}
          defaultValue={defaults?.description ?? ""}
          className="textarea"
          style={{ resize: "vertical" }}
        />
      </Field>

      <Checklist
        label="Classes"
        name="classIds"
        items={classes.map((c) => ({
          id: c.id,
          title: c.title,
          meta: c.durationMins ? `${c.durationMins} min` : null,
        }))}
        checked={checkedClassIds}
        emptyText="No classes yet — create some first."
      />
      <Checklist
        label="Series"
        name="seriesIds"
        items={series.map((s) => ({ id: s.id, title: s.title, meta: null }))}
        checked={checkedSeriesIds}
        emptyText="No series yet."
      />
      <Checklist
        label="Courses"
        name="courseIds"
        items={courses.map((c) => ({ id: c.id, title: c.title, meta: null }))}
        checked={checkedCourseIds}
        emptyText="No courses yet."
      />
    </>
  );
}

function Checklist({
  label,
  name,
  items,
  checked,
  emptyText,
}: {
  label: string;
  name: string;
  items: { id: string; title: string; meta: string | null }[];
  checked: Set<string>;
  emptyText: string;
}) {
  return (
    <Field label={label} hint="Check to include in this category">
      <div
        className="overflow-y-auto card"
        style={{ maxHeight: 240, background: "var(--surface)" }}
      >
        {items.length === 0 ? (
          <p className="p-4 text-sm" style={{ color: "var(--lichen)" }}>
            {emptyText}
          </p>
        ) : (
          items.map((it, i) => (
            <label
              key={it.id}
              className="flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors hover:bg-[color:var(--paper)]"
              style={
                i > 0 ? { borderTop: "1px solid var(--bone)" } : undefined
              }
            >
              <input
                type="checkbox"
                name={name}
                value={it.id}
                defaultChecked={checked.has(it.id)}
                className="w-4 h-4 accent-[color:var(--accent)]"
              />
              <span className="flex-1 text-sm" style={{ color: "var(--ink)" }}>
                {it.title}
              </span>
              {it.meta ? (
                <span
                  className="text-mono-sm"
                  style={{ color: "var(--lichen)" }}
                >
                  {it.meta}
                </span>
              ) : null}
            </label>
          ))
        )}
      </div>
    </Field>
  );
}
