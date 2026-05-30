import type { Category, Class, Tag } from "@prisma/client";
import { Field, ToggleRow } from "@/components/studio-form";
import { currencySymbol } from "@/lib/currency";

export function CourseFormFields({
  classes,
  tags,
  categories,
  defaults,
  currency = "usd",
}: {
  classes: Class[];
  tags: Tag[];
  categories: Category[];
  defaults?: {
    title?: string;
    eyebrow?: string | null;
    description?: string | null;
    coverUrl?: string | null;
    priceDollars?: number;
    visibleToPublic?: boolean;
    published?: boolean;
    classIds?: string[];
    tagIds?: string[];
    categoryIds?: string[];
  };
  currency?: string;
}) {
  const checkedTagIds = new Set(defaults?.tagIds ?? []);
  const checkedCategoryIds = new Set(defaults?.categoryIds ?? []);
  const orderedClassIds = defaults?.classIds ?? [];
  const orderedSet = new Set(orderedClassIds);
  const orderedClasses = [
    ...orderedClassIds
      .map((id) => classes.find((c) => c.id === id))
      .filter((c): c is Class => Boolean(c)),
    ...classes.filter((c) => !orderedSet.has(c.id)),
  ];

  return (
    <>
      <Field label="Title">
        <input
          name="title"
          required
          defaultValue={defaults?.title ?? ""}
          className="input"
          style={{ fontSize: "1.0625rem", fontWeight: 500 }}
        />
      </Field>
      <Field label="Eyebrow" hint="Small uppercase line above title (optional)">
        <input
          name="eyebrow"
          defaultValue={defaults?.eyebrow ?? ""}
          placeholder="Elevate your flexibility"
          className="input"
        />
      </Field>
      <Field label="Description">
        <textarea
          name="description"
          rows={6}
          defaultValue={defaults?.description ?? ""}
          className="textarea"
          style={{ resize: "vertical" }}
        />
      </Field>
      <Field label="Cover URL">
        <input
          name="coverUrl"
          type="url"
          defaultValue={defaults?.coverUrl ?? ""}
          className="input"
        />
      </Field>

      <Field label="Price" hint={`${currency.toUpperCase()} · one-time`}>
        <div
          className="input flex items-baseline"
          style={{ padding: "0.5rem 0.75rem" }}
        >
          <span style={{ color: "var(--lichen)" }}>{currencySymbol(currency)}</span>
          <input
            name="priceDollars"
            type="number"
            step="0.01"
            min={0}
            required
            defaultValue={defaults?.priceDollars ?? ""}
            className="flex-1 ml-1 bg-transparent outline-none"
            style={{ fontSize: "1.0625rem", fontWeight: 500, color: "var(--ink)" }}
          />
        </div>
      </Field>

      <Field label="Classes" hint="Check to include · order top-to-bottom">
        <div
          className="overflow-y-auto card"
          style={{ maxHeight: 320, background: "var(--surface)" }}
        >
          {orderedClasses.length === 0 ? (
            <p className="p-4 text-sm" style={{ color: "var(--lichen)" }}>No classes yet.</p>
          ) : (
            orderedClasses.map((c, i) => (
              <label
                key={c.id}
                className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-[color:var(--paper)]"
                style={i > 0 ? { borderTop: "1px solid var(--bone)" } : undefined}
              >
                <input
                  type="checkbox"
                  name="classIds"
                  value={c.id}
                  defaultChecked={orderedSet.has(c.id)}
                  className="w-4 h-4 accent-[color:var(--accent)]"
                />
                <input type="hidden" name="classOrder" value={c.id} />
                <span className="text-mono-sm w-6 shrink-0" style={{ color: "var(--muted)" }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="flex-1 text-sm" style={{ color: "var(--ink)" }}>{c.title}</span>
                {c.durationMins ? (
                  <span className="text-mono-sm" style={{ color: "var(--lichen)" }}>
                    {c.durationMins} min
                  </span>
                ) : null}
              </label>
            ))
          )}
        </div>
      </Field>

      <Field label="Categories" hint="Group this course with related content">
        {categories.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--lichen)" }}>
            No categories yet. <a className="btn-quiet" href="/studio/categories">Create some →</a>
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {categories.map((c) => (
              <SelectChip
                key={c.id}
                inputName="categoryIds"
                id={c.id}
                label={c.name}
                defaultChecked={checkedCategoryIds.has(c.id)}
              />
            ))}
          </div>
        )}
      </Field>

      <Field label="Tags">
        {tags.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--lichen)" }}>No tags yet.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <SelectChip
                key={t.id}
                inputName="tagIds"
                id={t.id}
                label={t.name}
                defaultChecked={checkedTagIds.has(t.id)}
              />
            ))}
          </div>
        )}
      </Field>

      <div className="pt-2 space-y-3" style={{ borderTop: "1px solid var(--bone)" }}>
        <ToggleRow
          name="visibleToPublic"
          defaultChecked={defaults?.visibleToPublic ?? true}
          title="Visible to non-subscribers"
        />
        <ToggleRow
          name="published"
          defaultChecked={defaults?.published ?? true}
          title="Published"
        />
      </div>
    </>
  );
}

function SelectChip({
  inputName,
  id,
  label,
  defaultChecked,
}: {
  inputName: string;
  id: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm cursor-pointer"
      style={{
        background: "var(--paper)",
        border: "1px solid var(--bone)",
        borderRadius: 999,
        color: "var(--ink)",
      }}
    >
      <input
        type="checkbox"
        name={inputName}
        value={id}
        defaultChecked={defaultChecked}
        className="w-3.5 h-3.5 accent-[color:var(--accent)]"
      />
      <span>{label}</span>
    </label>
  );
}
