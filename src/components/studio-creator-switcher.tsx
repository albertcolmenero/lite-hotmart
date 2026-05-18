"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, LogOut, Shield } from "lucide-react";
import {
  switchToCreatorAction,
  exitImpersonationAction,
} from "@/app/studio/_actions/switch-creator";

export type SwitcherCreator = {
  id: string;
  slug: string;
  displayName: string;
};

export function StudioCreatorSwitcher({
  active,
  creators,
  ownCreatorId,
}: {
  active: SwitcherCreator;
  creators: SwitcherCreator[];
  /** The super admin's own creator (if any). Used to label the "back to mine" row. */
  ownCreatorId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const isImpersonating = ownCreatorId !== null && ownCreatorId !== active.id;

  const filtered = creators.filter((c) => {
    const q = filter.trim().toLowerCase();
    if (!q) return true;
    return (
      c.displayName.toLowerCase().includes(q) ||
      c.slug.toLowerCase().includes(q)
    );
  });

  return (
    <div ref={wrapperRef} className="relative px-3 py-2">
      <div
        className="text-xs font-medium px-2 mb-1.5 inline-flex items-center gap-1.5"
        style={{ color: "var(--muted)" }}
      >
        <Shield size={11} strokeWidth={2.25} />
        Super admin
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-md text-sm transition-colors"
        style={{
          background: open ? "var(--stone)" : "var(--surface)",
          border: "1px solid var(--bone)",
          color: "var(--ink)",
        }}
      >
        <span className="flex flex-col items-start min-w-0">
          <span className="font-medium truncate w-full text-left">
            {active.displayName}
          </span>
          <span
            className="text-mono-sm truncate w-full text-left"
            style={{ color: "var(--muted)" }}
          >
            @{active.slug}
          </span>
        </span>
        <ChevronDown
          size={14}
          strokeWidth={2}
          style={{ color: "var(--lichen)" }}
        />
      </button>

      {isImpersonating ? (
        <div
          className="mt-1.5 text-xs px-2"
          style={{ color: "var(--amber)" }}
        >
          Viewing as another publisher
        </div>
      ) : null}

      {open ? (
        <div
          className="absolute z-30 left-3 right-3 mt-1 rounded-md overflow-hidden"
          style={{
            background: "var(--paper)",
            border: "1px solid var(--bone)",
            boxShadow: "var(--shadow-pop)",
          }}
        >
          <input
            type="text"
            placeholder="Find a studio…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            autoFocus
            className="w-full px-3 py-2 text-sm outline-none"
            style={{
              background: "var(--surface)",
              color: "var(--ink)",
              borderBottom: "1px solid var(--bone)",
            }}
          />
          <ul className="max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <li
                className="px-3 py-2 text-sm"
                style={{ color: "var(--lichen)" }}
              >
                No matches.
              </li>
            ) : (
              filtered.map((c) => {
                const isActive = c.id === active.id;
                return (
                  <li key={c.id}>
                    <form action={switchToCreatorAction}>
                      <input type="hidden" name="creatorId" value={c.id} />
                      <button
                        type="submit"
                        className="w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 transition-colors hover:bg-[color:var(--surface)]"
                        style={{ color: "var(--ink)" }}
                      >
                        <span className="flex flex-col min-w-0">
                          <span className="font-medium truncate">
                            {c.displayName}
                          </span>
                          <span
                            className="text-mono-sm truncate"
                            style={{ color: "var(--muted)" }}
                          >
                            @{c.slug}
                          </span>
                        </span>
                        {isActive ? (
                          <Check
                            size={14}
                            strokeWidth={2}
                            style={{ color: "var(--accent)" }}
                          />
                        ) : null}
                      </button>
                    </form>
                  </li>
                );
              })
            )}
          </ul>
          {isImpersonating ? (
            <form
              action={exitImpersonationAction}
              style={{ borderTop: "1px solid var(--bone)" }}
            >
              <button
                type="submit"
                className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors hover:bg-[color:var(--surface)]"
                style={{ color: "var(--ink)" }}
              >
                <LogOut size={14} strokeWidth={2} />
                Back to my studio
              </button>
            </form>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
