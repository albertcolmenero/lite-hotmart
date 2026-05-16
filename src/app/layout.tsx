import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { IS_DEV_BYPASS } from "@/lib/dev-auth";
import { Toaster } from "@/components/toaster";
import "./globals.css";

export const metadata: Metadata = {
  title: "lite-hotmart — the studio behind your studio",
  description:
    "Memberships, courses, and a place to gather the people who actually read what you make.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const html = (
    <html lang="en" className="h-full antialiased">
      <body
        className="min-h-full flex flex-col"
        style={{ background: "var(--surface-page)" }}
      >
        {IS_DEV_BYPASS ? (
          <div
            className="text-mono-sm px-4 py-1.5 text-center"
            style={{
              background: "var(--ink)",
              color: "var(--paper)",
              letterSpacing: "0.04em",
            }}
          >
            DEV_AUTH_BYPASS · you are the seeded dev user
          </div>
        ) : null}
        {children}
        <Toaster />
      </body>
    </html>
  );

  return IS_DEV_BYPASS ? html : <ClerkProvider>{html}</ClerkProvider>;
}
