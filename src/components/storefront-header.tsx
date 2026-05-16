"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, User, Crown } from "lucide-react";

export type StorefrontTab = {
  id: string;
  label: string;
  href: string;
  matchPrefix: string;
};

export function StorefrontHeader({
  creatorSlug,
  accentColor,
  logoUrl,
  tabs,
  isMember = false,
}: {
  creatorSlug: string;
  accentColor: string;
  logoUrl: string | null;
  tabs: StorefrontTab[];
  isMember?: boolean;
}) {
  const pathname = usePathname() ?? "";

  return (
    <header
      className="sticky top-0 z-30"
      style={{
        background: "color-mix(in srgb, var(--paper) 80%, transparent)",
        backdropFilter: "saturate(180%) blur(12px)",
        WebkitBackdropFilter: "saturate(180%) blur(12px)",
        borderBottom: "1px solid var(--bone)",
      }}
    >
      <div className="max-w-[1180px] mx-auto h-14 px-4 sm:px-6 grid grid-cols-3 items-center">
        <div className="flex items-center min-w-0">
          <Link
            href={`/${creatorSlug}`}
            aria-label="Home"
            className="flex items-center min-w-0"
          >
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt=""
                className="block object-contain object-left"
                style={{ maxHeight: 36, maxWidth: 180 }}
              />
            ) : (
              <span
                aria-hidden
                className="inline-block w-2.5 h-2.5 rounded-full"
                style={{ background: accentColor }}
              />
            )}
          </Link>
        </div>

        <nav className="flex items-center justify-center gap-1 text-sm">
          {tabs.map((t) => {
            const active = pathname.startsWith(t.matchPrefix);
            return (
              <Link
                key={t.id}
                href={t.href}
                className="px-3 py-1.5 rounded-md transition-colors"
                style={{
                  color: active ? "var(--ink)" : "var(--lichen)",
                  background: active ? "var(--stone)" : "transparent",
                  fontWeight: active ? 600 : 500,
                }}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center justify-end gap-2">
          {isMember ? (
            <span
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full member-pill"
              style={{
                background:
                  "linear-gradient(135deg, #F7D77A 0%, #E6B23A 45%, #B8860B 100%)",
                color: "#3D2902",
                boxShadow:
                  "0 1px 2px rgba(184, 134, 11, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.55)",
                letterSpacing: "-0.005em",
              }}
              aria-label="Active membership"
            >
              <Crown size={11} strokeWidth={2.5} fill="currentColor" />
              Member
            </span>
          ) : null}
          <Link
            href="/library"
            aria-label="My library"
            className="inline-flex items-center justify-center w-9 h-9 rounded-md transition-colors hover:bg-[color:var(--stone)]"
            style={{ color: "var(--lichen)" }}
          >
            <User size={18} strokeWidth={1.75} />
          </Link>
          <button
            type="button"
            aria-label="Menu"
            className="inline-flex items-center justify-center w-9 h-9 rounded-md transition-colors hover:bg-[color:var(--stone)]"
            style={{ color: "var(--lichen)" }}
          >
            <Menu size={18} strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </header>
  );
}
