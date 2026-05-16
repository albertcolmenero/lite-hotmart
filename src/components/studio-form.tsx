import type { ReactNode } from "react";

/**
 * Studio form primitives. Filled inputs, focus ring, sentence-case labels.
 */

export function FormCard({
  title,
  description,
  children,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="card p-6">
      {title || description ? (
        <header className="mb-5">
          {title ? <h2 className="text-h3">{title}</h2> : null}
          {description ? (
            <p className="mt-1 text-sm" style={{ color: "var(--lichen)" }}>
              {description}
            </p>
          ) : null}
        </header>
      ) : null}
      <div className="space-y-4">{children}</div>
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      {label ? (
        <div className="flex items-baseline justify-between mb-1.5">
          <span
            className="text-xs font-medium"
            style={{ color: "var(--lichen)" }}
          >
            {label}
          </span>
          {hint ? (
            <span className="text-xs" style={{ color: "var(--muted)" }}>
              {hint}
            </span>
          ) : null}
        </div>
      ) : null}
      {children}
    </label>
  );
}

// Re-exports for legacy callers
export const inputClass = "input";
export const inputStyle: React.CSSProperties = {};

export function ToggleRow({
  name,
  defaultChecked,
  title,
  body,
}: {
  name: string;
  defaultChecked?: boolean;
  title: string;
  body?: string;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-1 w-4 h-4 shrink-0 accent-[color:var(--accent)]"
      />
      <div>
        <div className="text-sm font-medium" style={{ color: "var(--ink)" }}>
          {title}
        </div>
        {body ? (
          <div className="text-sm" style={{ color: "var(--lichen)" }}>
            {body}
          </div>
        ) : null}
      </div>
    </label>
  );
}
