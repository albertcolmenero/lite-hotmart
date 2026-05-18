"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { UserMenu } from "@/components/user-menu";
import {
  StudioCreatorSwitcher,
  type SwitcherCreator,
} from "@/components/studio-creator-switcher";

export type NavGroup = {
  label: string;
  items: { href: string; label: string }[];
};

export type Creator = {
  slug: string;
  displayName: string;
  published: boolean;
};

export type SuperAdminProps = {
  active: SwitcherCreator;
  creators: SwitcherCreator[];
  ownCreatorId: string | null;
};

export function StudioSidebar({
  nav,
  creator,
  superAdmin,
}: {
  nav: NavGroup[];
  creator: Creator;
  superAdmin?: SuperAdminProps;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* mobile top bar */}
      <div
        className="lg:hidden h-14 flex items-center justify-between px-4 sticky top-0 z-30"
        style={{
          background: "var(--paper)",
          borderBottom: "1px solid var(--bone)",
        }}
      >
        <Link href="/" className="flex items-center gap-2">
          <span className="inline-block w-5 h-5 rounded-md" style={{ background: "var(--ink)" }} />
          <span className="font-medium tracking-tight">Lite Creator</span>
        </Link>
        <button
          type="button"
          aria-label="Open menu"
          onClick={() => setOpen(true)}
          className="btn btn-ghost"
          style={{ width: 36, height: 36, padding: 0 }}
        >
          <Menu size={18} strokeWidth={1.75} />
        </button>
      </div>

      <SidebarInner nav={nav} creator={creator} superAdmin={superAdmin} />

      <AnimatePresence>
        {open ? (
          <div className="lg:hidden fixed inset-0 z-50">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setOpen(false)}
              className="absolute inset-0"
              style={{ background: "rgba(10, 10, 11, 0.45)", backdropFilter: "blur(4px)" }}
            />
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              className="absolute top-0 left-0 bottom-0 w-72 flex flex-col"
              style={{ background: "var(--paper)", borderRight: "1px solid var(--bone)" }}
            >
              <div
                className="h-14 flex items-center justify-between px-4"
                style={{ borderBottom: "1px solid var(--bone)" }}
              >
                <div className="flex items-center gap-2">
                  <span className="inline-block w-5 h-5 rounded-md" style={{ background: "var(--ink)" }} />
                  <span className="font-medium tracking-tight">Lite Creator</span>
                </div>
                <button
                  type="button"
                  aria-label="Close menu"
                  onClick={() => setOpen(false)}
                  className="btn btn-ghost"
                  style={{ width: 32, height: 32, padding: 0 }}
                >
                  <X size={16} strokeWidth={2} />
                </button>
              </div>
              <DrawerNav
                nav={nav}
                creator={creator}
                superAdmin={superAdmin}
                onNav={() => setOpen(false)}
              />
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

function SidebarInner({
  nav,
  creator,
  superAdmin,
}: {
  nav: NavGroup[];
  creator: Creator;
  superAdmin?: SuperAdminProps;
}) {
  const pathname = usePathname();
  return (
    <aside
      className="hidden lg:flex w-60 flex-col shrink-0"
      style={{
        background: "var(--paper)",
        borderRight: "1px solid var(--bone)",
      }}
    >
      <div
        className="h-14 flex items-center px-5"
        style={{ borderBottom: "1px solid var(--bone)" }}
      >
        <Link href="/" className="flex items-center gap-2">
          <span className="inline-block w-5 h-5 rounded-md" style={{ background: "var(--ink)" }} />
          <span className="font-medium tracking-tight">Lite Creator</span>
        </Link>
      </div>

      {superAdmin ? (
        <div style={{ borderBottom: "1px solid var(--bone)" }}>
          <StudioCreatorSwitcher
            active={superAdmin.active}
            creators={superAdmin.creators}
            ownCreatorId={superAdmin.ownCreatorId}
          />
        </div>
      ) : null}

      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {nav.map((group) => (
          <div key={group.label}>
            <div
              className="text-xs font-medium px-3 mb-1.5"
              style={{ color: "var(--muted)" }}
            >
              {group.label}
            </div>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active =
                  item.href === "/studio"
                    ? pathname === item.href
                    : pathname?.startsWith(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="block px-3 py-1.5 text-sm rounded-md transition-colors"
                      style={{
                        color: "var(--ink)",
                        fontWeight: active ? 500 : 400,
                        background: active ? "var(--stone)" : "transparent",
                      }}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <FooterBlock creator={creator} />
    </aside>
  );
}

function DrawerNav({
  nav,
  creator,
  superAdmin,
  onNav,
}: {
  nav: NavGroup[];
  creator: Creator;
  superAdmin?: SuperAdminProps;
  onNav: () => void;
}) {
  const pathname = usePathname();
  return (
    <div className="flex-1 flex flex-col">
      {superAdmin ? (
        <div style={{ borderBottom: "1px solid var(--bone)" }}>
          <StudioCreatorSwitcher
            active={superAdmin.active}
            creators={superAdmin.creators}
            ownCreatorId={superAdmin.ownCreatorId}
          />
        </div>
      ) : null}
      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {nav.map((group) => (
          <div key={group.label}>
            <div className="text-xs font-medium px-3 mb-1.5" style={{ color: "var(--muted)" }}>
              {group.label}
            </div>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active =
                  item.href === "/studio"
                    ? pathname === item.href
                    : pathname?.startsWith(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNav}
                      className="block px-3 py-1.5 text-sm rounded-md transition-colors"
                      style={{
                        color: "var(--ink)",
                        fontWeight: active ? 500 : 400,
                        background: active ? "var(--stone)" : "transparent",
                      }}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <FooterBlock creator={creator} />
    </div>
  );
}

function FooterBlock({ creator }: { creator: Creator }) {
  return (
    <div
      className="px-3 pt-3 pb-4 space-y-2"
      style={{ borderTop: "1px solid var(--bone)" }}
    >
      <Link
        href={`/${creator.slug}`}
        target="_blank"
        className="btn btn-secondary w-full text-xs"
        style={{ height: 32, padding: "0 12px" }}
      >
        Preview as visitor
      </Link>
      <Link
        href="/studio/publish"
        className={`w-full text-xs btn ${creator.published ? "btn-secondary" : "btn-primary"}`}
        style={{ height: 32, padding: "0 12px" }}
      >
        {creator.published ? "Manage publish" : "Publish profile"}
      </Link>
      <div className="flex items-center justify-between pt-2 px-1">
        <span
          className="inline-flex items-center gap-1.5 text-xs"
          style={{ color: creator.published ? "var(--moss)" : "var(--lichen)" }}
        >
          <span
            className="inline-block w-1.5 h-1.5 rounded-full"
            style={{ background: "currentColor" }}
          />
          {creator.published ? "Live" : "Draft"}
        </span>
        <UserMenu />
      </div>
    </div>
  );
}
