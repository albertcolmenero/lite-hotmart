import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { UserMenu } from "@/components/user-menu";
import { getCreatorForCurrentUser } from "@/lib/auth";

export default async function LibraryLayout({ children }: { children: React.ReactNode }) {
  const creator = await getCreatorForCurrentUser();

  return (
    <div
      className="flex flex-col flex-1"
      style={{ background: "var(--surface-page)" }}
    >
      <header
        className="sticky top-0 z-30"
        style={{
          background: "color-mix(in srgb, var(--paper) 80%, transparent)",
          backdropFilter: "saturate(180%) blur(12px)",
          borderBottom: "1px solid var(--bone)",
        }}
      >
        <div className="max-w-[1180px] mx-auto h-14 px-6 flex items-center justify-between">
          <Link href="/library" className="flex items-center gap-2">
            <span className="inline-block w-5 h-5 rounded-md" style={{ background: "var(--ink)" }} />
            <span className="font-medium tracking-tight">My library</span>
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            {creator ? (
              <Link href="/studio" className="btn btn-ghost">
                <ArrowLeft size={14} strokeWidth={2} />
                Studio
              </Link>
            ) : null}
            <Link href="/library/billing" className="btn btn-ghost">
              Billing
            </Link>
            <UserMenu />
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-[1180px] mx-auto w-full px-6 py-10">
        {children}
      </main>
    </div>
  );
}
