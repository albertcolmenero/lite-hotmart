import { getCreatorForCurrentUser } from "@/lib/auth";
import { FormCard, Field } from "@/components/studio-form";
import { ThemeTile } from "@/components/theme-tile";
import { STOREFRONT_THEMES, DEFAULT_THEME_ID } from "@/lib/themes";
import type { HomeDoc } from "@/lib/home-content";
import { HomeContentEditor } from "./_home-content-editor";
import { updateBrandingAction } from "./actions";

export default async function BrandingPage() {
  const creator = (await getCreatorForCurrentUser())!;
  return (
    <div className="max-w-2xl space-y-7">
      <header>
        <h1 className="text-h1">Branding</h1>
        <p className="mt-1.5" style={{ color: "var(--lichen)" }}>
          Your name, your bio, your accent. This is what readers feel before the first sentence.
        </p>
      </header>

      <form action={updateBrandingAction} className="space-y-5">
        <button type="submit" className="btn btn-primary">Save branding</button>
        <FormCard>
          <Field label="Display name">
            <input
              name="displayName"
              defaultValue={creator.displayName}
              className="input"
              style={{ fontSize: "1.0625rem", fontWeight: 500 }}
            />
          </Field>
          <Field label="Home page" hint="Shown at the top of your storefront">
            <HomeContentEditor
              initialContent={creator.homeContent as HomeDoc | null}
              fallbackBio={creator.bio}
            />
          </Field>
          <Field label="Logo URL" hint="Shown in the top menu (left). Leave blank for none.">
            <input
              name="logoUrl"
              type="url"
              defaultValue={creator.logoUrl ?? ""}
              placeholder="https://…/logo.png"
              className="input"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Accent color" hint="Used across your storefront">
              <div className="flex items-center gap-3">
                <input
                  name="accentColor"
                  type="color"
                  defaultValue={creator.accentColor}
                  className="cursor-pointer"
                  style={{
                    height: 40,
                    width: 64,
                    border: "1px solid var(--bone)",
                    borderRadius: "var(--radius-md)",
                    padding: 0,
                  }}
                />
                <span className="text-mono-sm" style={{ color: "var(--lichen)" }}>
                  {creator.accentColor}
                </span>
              </div>
            </Field>
            <Field label="Heading style">
              <select
                name="fontPair"
                defaultValue={creator.fontPair}
                className="select"
              >
                <option value="inter">Sans (modern)</option>
                <option value="fraunces">Serif (editorial)</option>
              </select>
            </Field>
          </div>
          <Field label="Site theme" hint="Background + text colors for your storefront">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {STOREFRONT_THEMES.map((t) => (
                <ThemeTile
                  key={t.id}
                  theme={t}
                  mode="selectable"
                  defaultChecked={
                    (creator.themeId ?? DEFAULT_THEME_ID) === t.id
                  }
                />
              ))}
            </div>
          </Field>
        </FormCard>

        <button type="submit" className="btn btn-primary">Save branding</button>
      </form>
    </div>
  );
}
