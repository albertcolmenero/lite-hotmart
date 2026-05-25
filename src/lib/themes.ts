/**
 * Curated background themes for the public storefront. Each theme bundles a
 * background color and the paired text colors so combinations stay readable
 * and elegant. Publishers pick one in /studio/branding; the storefront layout
 * applies the vars to a wrapper div and the rest of the page (header, cards,
 * paywall modal, etc.) inherits them via CSS custom property cascade.
 *
 * The creator's accentColor is intentionally NOT part of a theme — it stays
 * user-controlled and is rendered on top of whatever background they pick.
 */

export type StorefrontThemeVars = {
  "--surface": string;
  "--paper": string;
  "--stone": string;
  "--bone": string;
  "--ink": string;
  "--lichen": string;
  "--muted": string;
};

export type StorefrontTheme = {
  id: string;
  label: string;
  vars: StorefrontThemeVars;
};

export const STOREFRONT_THEMES: StorefrontTheme[] = [
  {
    id: "paper",
    label: "Paper",
    vars: {
      "--surface": "#F7F7F8",
      "--paper": "#FFFFFF",
      "--stone": "#EFEFF1",
      "--bone": "#E5E5E7",
      "--ink": "#0A0A0B",
      "--lichen": "#6B6B70",
      "--muted": "#A1A1A6",
    },
  },
  {
    id: "cream",
    label: "Cream",
    vars: {
      "--surface": "#FAF6EF",
      "--paper": "#FFFCF6",
      "--stone": "#F0EADF",
      "--bone": "#E4DDCE",
      "--ink": "#1B1610",
      "--lichen": "#6E6354",
      "--muted": "#A39684",
    },
  },
  {
    id: "sage",
    label: "Sage",
    vars: {
      "--surface": "#EEF2EC",
      "--paper": "#F8FAF6",
      "--stone": "#E1E8DD",
      "--bone": "#CDD7C8",
      "--ink": "#16201A",
      "--lichen": "#566459",
      "--muted": "#8A968D",
    },
  },
  {
    id: "lavender",
    label: "Lavender",
    vars: {
      "--surface": "#F2EFF8",
      "--paper": "#FBFAFE",
      "--stone": "#E6E1F0",
      "--bone": "#D4CCE3",
      "--ink": "#15101F",
      "--lichen": "#5F5572",
      "--muted": "#938AA3",
    },
  },
  {
    id: "ink",
    label: "Ink",
    vars: {
      "--surface": "#0E0E11",
      "--paper": "#18181B",
      "--stone": "#23232A",
      "--bone": "#2F2F38",
      "--ink": "#F4F4F5",
      "--lichen": "#A6A6AD",
      "--muted": "#71717A",
    },
  },
];

export const STOREFRONT_THEME_IDS = STOREFRONT_THEMES.map((t) => t.id);

export const DEFAULT_THEME_ID = "paper";

export function getTheme(id: string | null | undefined): StorefrontTheme {
  if (id) {
    const found = STOREFRONT_THEMES.find((t) => t.id === id);
    if (found) return found;
  }
  return STOREFRONT_THEMES.find((t) => t.id === DEFAULT_THEME_ID)!;
}

export function isStorefrontThemeId(v: unknown): v is string {
  return typeof v === "string" && STOREFRONT_THEME_IDS.includes(v);
}
