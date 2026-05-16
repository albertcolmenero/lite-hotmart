import { redirect } from "next/navigation";
import { getOrCreateDbUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Field, FormCard } from "@/components/studio-form";
import { createCreatorAction } from "./actions";

export default async function OnboardingPage() {
  const user = await getOrCreateDbUser();
  if (!user) redirect("/sign-in");

  const existing = await db.creator.findUnique({ where: { userId: user.id } });
  if (existing) redirect("/studio");

  return (
    <div className="flex-1" style={{ background: "var(--surface-page)" }}>
      <div className="max-w-xl mx-auto px-6 py-16">
        <div className="text-sm" style={{ color: "var(--lichen)" }}>
          Step 1 of 1
        </div>
        <h1 className="text-h1 mt-2">Set up your studio.</h1>
        <p className="mt-3" style={{ color: "var(--lichen)" }}>
          Pick a public URL and tell people who you are. Stripe comes later — right before you publish.
        </p>

        <form action={createCreatorAction} className="mt-8 space-y-5">
          <FormCard>
            <Field label="Public URL" hint="Lowercase, numbers, dashes">
              <div className="input flex items-baseline" style={{ padding: "0.5rem 0.75rem" }}>
                <span className="text-mono-sm pr-1 shrink-0" style={{ color: "var(--lichen)" }}>
                  lite-hotmart.com/
                </span>
                <input
                  name="slug"
                  required
                  pattern="^[a-z0-9-]{3,30}$"
                  placeholder="janedoe"
                  className="flex-1 bg-transparent outline-none input-mono"
                  style={{ color: "var(--ink)", fontSize: "0.9375rem" }}
                />
              </div>
            </Field>

            <Field label="Display name">
              <input
                name="displayName"
                required
                placeholder="Jane Doe"
                className="input"
                style={{ fontSize: "1.0625rem", fontWeight: 500 }}
              />
            </Field>

            <Field label="Bio" hint="One sentence works best">
              <textarea
                name="bio"
                rows={3}
                placeholder="Filmmaker teaching color grading."
                className="textarea"
                style={{ resize: "vertical" }}
              />
            </Field>

            <Field label="Accent color">
              <div className="flex items-center gap-3">
                <input
                  name="accentColor"
                  type="color"
                  defaultValue="#5046E5"
                  className="cursor-pointer"
                  style={{
                    height: 40,
                    width: 64,
                    border: "1px solid var(--bone)",
                    borderRadius: "var(--radius-md)",
                    padding: 0,
                  }}
                />
                <span className="text-sm" style={{ color: "var(--lichen)" }}>
                  Used across your storefront.
                </span>
              </div>
            </Field>
          </FormCard>

          <button type="submit" className="btn btn-primary btn-lg w-full">
            Continue → open my studio
          </button>
        </form>
      </div>
    </div>
  );
}
