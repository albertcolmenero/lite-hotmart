import type { JSONContent } from "@tiptap/core";

/**
 * Rich "home page" content for a creator's storefront — a Tiptap document stored
 * in `Creator.homeContent`. Edited on Studio → Branding, rendered on the public
 * creator landing page. Helpers here are pure (no React) so both the server
 * action and the server renderer can use them.
 */
export type HomeDoc = JSONContent;

// Guard against an oversized hidden-input payload reaching the DB.
const MAX_CHARS = 100_000;
// A home doc from this editor is at most a few levels deep; bound depth and node
// count so a pathological (or hand-crafted raw POST) payload can't overflow the
// recursive validator/renderer and permanently brick the public page.
const MAX_DEPTH = 50;
const MAX_NODES = 5_000;

/**
 * Validate + normalize the JSON submitted from the editor's hidden input.
 * Returns a Tiptap doc, or `null` when the input is empty / malformed / oversized
 * / has no meaningful content. Callers treat `null` as "no rich content".
 */
export function parseHomeContent(raw: unknown): HomeDoc | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed === "" || trimmed.length > MAX_CHARS) return null;
  let doc: unknown;
  try {
    doc = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (!doc || typeof doc !== "object") return null;
  if ((doc as { type?: unknown }).type !== "doc") return null;
  const result = doc as HomeDoc;
  if (!withinBounds(result)) return null;
  return isHomeDocEmpty(result) ? null : result;
}

/** Iterative (stack-safe) check that the doc isn't pathologically deep/large. */
function withinBounds(doc: HomeDoc): boolean {
  const stack: Array<{ node: JSONContent; depth: number }> = [{ node: doc, depth: 0 }];
  let count = 0;
  while (stack.length > 0) {
    const { node, depth } = stack.pop()!;
    if (depth > MAX_DEPTH) return false;
    if (++count > MAX_NODES) return false;
    const children = node.content;
    if (Array.isArray(children)) {
      for (const child of children) stack.push({ node: child, depth: depth + 1 });
    }
  }
  return true;
}

/**
 * True when a doc carries no meaningful content (e.g. the empty paragraph the
 * editor always emits). Drives the "fall back to the plain bio" decision.
 */
export function isHomeDocEmpty(doc: HomeDoc | null | undefined): boolean {
  if (!doc) return true;
  const content = doc.content;
  if (!Array.isArray(content) || content.length === 0) return true;
  return content.every(isNodeEmpty);
}

function isNodeEmpty(node: JSONContent): boolean {
  // Atom nodes the renderer handles always count as real content.
  if (node.type === "video" || node.type === "horizontalRule") {
    return false;
  }
  if (node.type === "text") {
    return !node.text || node.text.trim() === "";
  }
  if (Array.isArray(node.content) && node.content.length > 0) {
    return node.content.every(isNodeEmpty);
  }
  // No children and no text (e.g. an empty paragraph) → empty.
  return true;
}

const SAFE_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

/**
 * Returns the URL only if it uses a safe scheme (http/https/mailto), else null.
 * The server render is the trust boundary for stored link hrefs.
 */
export function safeHref(url: unknown): string | null {
  if (typeof url !== "string") return null;
  try {
    return SAFE_PROTOCOLS.has(new URL(url).protocol) ? url : null;
  } catch {
    return null;
  }
}
