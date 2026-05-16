import Link from "next/link";
import type { ReactNode } from "react";

export function EmptyState({
  illustration,
  title,
  body,
  primary,
  secondary,
}: {
  illustration: ReactNode;
  title: string;
  body: string;
  primary?: { label: string; href: string };
  secondary?: { label: string; href: string };
}) {
  return (
    <div className="card p-10 text-center">
      <div className="mx-auto" style={{ maxWidth: 200 }}>
        {illustration}
      </div>
      <h2 className="text-h3 mt-5">{title}</h2>
      <p className="mt-2 mx-auto text-sm" style={{ color: "var(--lichen)", maxWidth: 380, lineHeight: 1.6 }}>
        {body}
      </p>
      {primary || secondary ? (
        <div className="mt-5 flex items-center justify-center gap-3">
          {primary ? (
            <Link href={primary.href} className="btn btn-primary">
              {primary.label}
            </Link>
          ) : null}
          {secondary ? (
            <Link href={secondary.href} className="btn-quiet">
              {secondary.label}
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
