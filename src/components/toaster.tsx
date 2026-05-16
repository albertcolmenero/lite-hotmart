"use client";

import { Toaster as Sonner } from "sonner";

/**
 * Editorial toast system. Restrained — paper bg, ink type, mono helper,
 * left ember bar on success/error. Mounted once in the root layout.
 */
export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      gap={8}
      offset={20}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "flex items-start gap-3 min-w-[280px] max-w-[420px] px-4 py-3 text-sm",
          title: "font-medium",
          description: "text-[0.8125rem] mt-0.5",
        },
        style: {
          background: "var(--paper)",
          color: "var(--ink)",
          border: "1px solid var(--bone)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-lifted)",
        },
      }}
    />
  );
}
