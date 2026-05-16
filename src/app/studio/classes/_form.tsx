import type { Category, Tag } from "@prisma/client";
import { Field, ToggleRow } from "@/components/studio-form";

export function ClassFormFields({
  defaults,
  tags,
  categories,
}: {
  defaults?: {
    title?: string;
    description?: string | null;
    videoProvider?: "youtube" | "vimeo";
    videoUrl?: string;
    thumbnailUrl?: string | null;
    durationMins?: number | null;
    visibleToPublic?: boolean;
    freeForEveryone?: boolean;
    standalone?: boolean;
    published?: boolean;
    tagIds?: string[];
    categoryIds?: string[];
  };
  tags: Tag[];
  categories: Category[];
}) {
  const checkedTagIds = new Set(defaults?.tagIds ?? []);
  const checkedCategoryIds = new Set(defaults?.categoryIds ?? []);
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

      <div className="grid grid-cols-3 gap-4">
        <Field label="Provider">
          <select
            name="videoProvider"
            defaultValue={defaults?.videoProvider ?? "youtube"}
            className="select"
          >
            <option value="youtube">YouTube</option>
            <option value="vimeo">Vimeo</option>
          </select>
        </Field>
        <Field label="Video URL">
          <input
            name="videoUrl"
            type="url"
            required
            defaultValue={defaults?.videoUrl ?? ""}
            placeholder="https://youtu.be/..."
            className="input"
          />
        </Field>
        <Field label="Duration" hint="min">
          <input
            name="durationMins"
            type="number"
            min={0}
            defaultValue={defaults?.durationMins ?? ""}
            className="input input-mono"
          />
        </Field>
      </div>

      <Field label="Thumbnail URL" hint="Optional — auto-derived from YouTube">
        <input
          name="thumbnailUrl"
          type="url"
          defaultValue={defaults?.thumbnailUrl ?? ""}
          className="input"
        />
      </Field>

      <Field label="Description">
        <textarea
          name="description"
          rows={5}
          defaultValue={defaults?.description ?? ""}
          className="textarea"
          style={{ resize: "vertical" }}
        />
      </Field>

      <Field label="Categories" hint="Group this class with related content">
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
          <p className="text-sm" style={{ color: "var(--lichen)" }}>
            No tags yet. <a className="btn-quiet" href="/studio/tags">Create some →</a>
          </p>
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
          body="Show in the public catalog. Paywall modal triggers on play."
        />
        <ToggleRow
          name="freeForEveryone"
          defaultChecked={defaults?.freeForEveryone ?? false}
          title="Free for everyone"
          body="Bypass paywall entirely. Use sparingly as a teaser."
        />
        <ToggleRow
          name="standalone"
          defaultChecked={defaults?.standalone ?? true}
          title="Available as a standalone class"
          body="Off: only accessible from inside a series it belongs to."
        />
        <ToggleRow
          name="published"
          defaultChecked={defaults?.published ?? true}
          title="Published"
          body="Live on your storefront. Draft to hide while you edit."
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
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm cursor-pointer transition-colors"
      style={{
        background: "var(--paper)",
        border: "1px solid var(--bone)",
        borderRadius: "999px",
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
