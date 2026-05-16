"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Check } from "lucide-react";

export function PublishCelebration({ creatorName }: { creatorName: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (params.get("saved") === "published") {
      setVisible(true);
      const t = setTimeout(() => {
        setVisible(false);
        const next = new URLSearchParams(params);
        next.delete("saved");
        const qs = next.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      }, 2800);
      return () => clearTimeout(t);
    }
  }, [params, router, pathname]);

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-6 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
        >
          <motion.div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(60% 50% at 50% 50%, color-mix(in srgb, var(--paper) 95%, transparent), transparent 80%)",
              backdropFilter: "blur(6px)",
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            className="relative text-center"
            initial={{ scale: 0.85, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: -10 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* wax seal */}
            <motion.div
              className="mx-auto rounded-full flex items-center justify-center"
              style={{
                width: 88,
                height: 88,
                background: "var(--accent)",
                color: "var(--paper)",
                boxShadow:
                  "inset 0 2px 4px rgba(255,255,255,0.1), 0 18px 40px -16px rgba(80,70,229,0.5)",
              }}
              initial={{ rotate: -20, scale: 0.4 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{
                type: "spring",
                damping: 14,
                stiffness: 220,
                delay: 0.1,
              }}
            >
              <Check size={36} strokeWidth={2.5} />
            </motion.div>
            <motion.div
              className="mt-6 text-mono-sm"
              style={{ color: "var(--lichen)" }}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55, duration: 0.5 }}
            >
              PUBLISHED · {creatorName.toUpperCase()}
            </motion.div>
            <motion.h1
              className="mt-3"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(2rem, 4vw, 2.75rem)",
                lineHeight: 1.05,
                letterSpacing: "-0.02em",
                fontWeight: 480,
                color: "var(--ink)",
              }}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              You&apos;re <em>live</em>.
            </motion.h1>
            <motion.p
              className="mt-2 text-sm"
              style={{ color: "var(--lichen)" }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9, duration: 0.5 }}
            >
              Share your link and the first subscriber will find you.
            </motion.p>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
