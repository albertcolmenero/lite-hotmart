import Link from "next/link";

export function PreviewBanner() {
  return (
    <div
      className="sticky top-0 z-40 px-4 py-2 text-sm flex items-center justify-center gap-3"
      style={{
        background: "var(--ink)",
        color: "var(--paper)",
      }}
    >
      <span style={{ color: "var(--bone)" }}>Preview · not yet published</span>
      <Link
        href="/studio/publish"
        className="rounded-md px-3 py-0.5 text-xs font-medium"
        style={{ background: "var(--accent)", color: "var(--paper)" }}
      >
        Publish →
      </Link>
      <Link
        href="/studio"
        className="text-xs"
        style={{ color: "var(--bone)", textDecoration: "underline", textUnderlineOffset: 3 }}
      >
        Back to studio
      </Link>
    </div>
  );
}
