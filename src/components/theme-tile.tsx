import type { CSSProperties } from "react";
import type { StorefrontTheme } from "@/lib/themes";

/**
 * Preview tile for a storefront theme. Renders the theme's actual background +
 * text colors so the publisher sees real contrast before saving.
 *
 * Two modes:
 *  - "display"    — static tile (no input).
 *  - "selectable" — wraps a hidden radio input; the parent form posts themeId.
 *                   Selected state driven by `defaultChecked`, rendered via
 *                   `:has(input:checked)` on the outer label.
 */
export function ThemeTile({
  theme,
  mode = "display",
  defaultChecked,
}: {
  theme: StorefrontTheme;
  mode?: "display" | "selectable";
  defaultChecked?: boolean;
}) {
  const themeStyle = theme.vars as CSSProperties;

  const visual = (
    <div
      className="rounded-lg overflow-hidden"
      style={{
        ...themeStyle,
        background: "var(--surface)",
        border: "1px solid var(--bone)",
        padding: 12,
        height: 92,
      }}
    >
      <div
        style={{
          background: "var(--paper)",
          border: "1px solid var(--bone)",
          borderRadius: 8,
          padding: "8px 10px",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 2,
        }}
      >
        <div
          style={{
            color: "var(--ink)",
            fontWeight: 600,
            fontSize: "0.8125rem",
            letterSpacing: "-0.01em",
            lineHeight: 1.2,
          }}
        >
          {theme.label}
        </div>
        <div
          style={{
            color: "var(--lichen)",
            fontSize: "0.6875rem",
            lineHeight: 1.2,
          }}
        >
          Sample
        </div>
      </div>
    </div>
  );

  if (mode === "display") {
    return visual;
  }

  return (
    <label className="block cursor-pointer rounded-lg transition-shadow has-[input:checked]:shadow-[0_0_0_2px_var(--accent)]">
      <input
        type="radio"
        name="themeId"
        value={theme.id}
        defaultChecked={defaultChecked}
        className="sr-only"
      />
      {visual}
      <div
        className="mt-1.5 text-xs text-center"
        style={{ color: "var(--lichen)" }}
      >
        {theme.label}
      </div>
    </label>
  );
}
