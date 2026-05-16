import Link from "next/link";
import { ArrowUpRight, Check } from "lucide-react";
import { currentClerkUserId } from "@/lib/auth";
import { ScrollReveal } from "@/components/scroll-reveal";

export default async function Home() {
  const userId = await currentClerkUserId();
  const signedIn = Boolean(userId);

  return (
    <main className="flex-1">
      {/* ─────────────────────────── header */}
      <header
        className="sticky top-0 z-30"
        style={{
          background: "color-mix(in srgb, var(--paper) 80%, transparent)",
          backdropFilter: "saturate(180%) blur(12px)",
          WebkitBackdropFilter: "saturate(180%) blur(12px)",
          borderBottom: "1px solid var(--bone)",
        }}
      >
        <div className="max-w-[1180px] mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2" aria-label="lite-hotmart">
            <span
              className="inline-block w-5 h-5 rounded-md"
              style={{ background: "var(--ink)" }}
              aria-hidden
            />
            <span className="font-medium tracking-tight">lite-hotmart</span>
          </Link>

          <nav className="flex items-center gap-1 text-sm">
            <Link href="#features" className="btn btn-ghost">Features</Link>
            <Link href="#pricing" className="btn btn-ghost">Pricing</Link>
            <Link href="/dev" className="btn btn-ghost">Live demo</Link>
            {!signedIn ? (
              <>
                <Link href="/sign-in" className="btn btn-ghost">Sign in</Link>
                <Link href="/sign-up" className="btn btn-primary ml-1">
                  Get started
                </Link>
              </>
            ) : (
              <Link href="/studio" className="btn btn-primary ml-1">
                Open studio
              </Link>
            )}
          </nav>
        </div>
      </header>

      {/* ─────────────────────────── hero */}
      <section className="max-w-[1180px] mx-auto px-6 pt-28 pb-24">
        <div className="reveal">
          <span
            className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium"
            style={{
              background: "var(--accent-soft)",
              color: "var(--accent)",
            }}
          >
            <span
              aria-hidden
              className="inline-block w-1.5 h-1.5 rounded-full"
              style={{ background: "var(--accent)" }}
            />
            Now in private beta · No card required
          </span>
        </div>

        <h1
          className="text-display mt-6 max-w-3xl reveal reveal-delay-1"
          style={{ color: "var(--ink)" }}
        >
          The studio behind your studio.
        </h1>

        <p
          className="mt-6 max-w-xl text-lg reveal reveal-delay-2"
          style={{ color: "var(--lichen)" }}
        >
          Run a paid membership, sell courses, and keep the audience you built — without
          stitching together five SaaS tools to do it.
        </p>

        <div className="mt-9 flex flex-wrap items-center gap-3 reveal reveal-delay-3">
          <Link
            href={signedIn ? "/studio" : "/sign-up"}
            className="btn btn-primary btn-lg"
          >
            {signedIn ? "Open your studio" : "Start free"}
            <ArrowUpRight size={16} strokeWidth={2} />
          </Link>
          <Link href="/dev" className="btn btn-secondary btn-lg">
            See a live storefront
          </Link>
        </div>

        <div className="mt-6 text-sm" style={{ color: "var(--muted)" }}>
          Free until you sell. 8% per transaction. No subscription.
        </div>

        {/* preview card */}
        <ScrollReveal delay={0.1}>
          <div
            className="mt-20 card card-lift overflow-hidden"
            style={{ background: "var(--paper)" }}
          >
            <div
              className="px-5 py-3 flex items-center justify-between"
              style={{ borderBottom: "1px solid var(--bone)", background: "var(--surface)" }}
            >
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--bone)" }} />
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--bone)" }} />
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--bone)" }} />
                </div>
                <span className="ml-3 text-mono-sm" style={{ color: "var(--lichen)" }}>
                  lite-hotmart.com/dev/practice
                </span>
              </div>
              <span className="chip chip--quiet">Preview</span>
            </div>
            <div className="p-8 bg-grid" style={{ background: "var(--paper)" }}>
              <div className="grid sm:grid-cols-3 gap-4">
                <PreviewCard title="Hips 360" duration="55 min" />
                <PreviewCard title="Juicy Body Flow" duration="57 min" />
                <PreviewCard title="Flow, play, lift" duration="50 min" locked />
              </div>
            </div>
          </div>
        </ScrollReveal>
      </section>

      {/* ─────────────────────────── value props */}
      <section id="features" className="max-w-[1180px] mx-auto px-6 py-24">
        <ScrollReveal>
          <div className="max-w-2xl">
            <span className="text-label">Features</span>
            <h2 className="text-h1 mt-2">Everything you need. Nothing you don&apos;t.</h2>
            <p className="mt-4" style={{ color: "var(--lichen)" }}>
              Memberships, courses, content gating, analytics. Built like a product, not a stack of plugins.
            </p>
          </div>
        </ScrollReveal>

        <div className="mt-14 grid md:grid-cols-3 gap-4">
          {[
            {
              title: "Memberships",
              body: "One subscription, monthly and yearly. Free previews to drive conversion. Cancellations handled.",
              meta: ["Monthly + Yearly", "Free trials", "Drip release"],
            },
            {
              title: "Courses & add-ons",
              body: "Sell one-time programs to your subscribers. Modular, ordered, gated — everything subscribers expect.",
              meta: ["One-time sales", "Module structure", "Subscriber-only"],
            },
            {
              title: "Storefront",
              body: "A branded catalog at /you. Wears your color, your typography, your photography — not ours.",
              meta: ["Custom branding", "SEO-ready", "Mobile-first"],
            },
          ].map((f, i) => (
            <ScrollReveal key={f.title} delay={0.05 * i}>
              <div className="card card-pop p-6 h-full">
                <h3 className="text-h3">{f.title}</h3>
                <p className="mt-2 text-sm" style={{ color: "var(--lichen)" }}>
                  {f.body}
                </p>
                <ul className="mt-5 space-y-1.5">
                  {f.meta.map((m) => (
                    <li key={m} className="flex items-center gap-2 text-sm">
                      <Check size={14} strokeWidth={2.25} style={{ color: "var(--accent)" }} />
                      <span style={{ color: "var(--ink)" }}>{m}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* ─────────────────────────── stats / proof */}
      <section
        style={{
          borderTop: "1px solid var(--bone)",
          borderBottom: "1px solid var(--bone)",
          background: "var(--paper)",
        }}
      >
        <div className="max-w-[1180px] mx-auto px-6 py-16 grid grid-cols-2 md:grid-cols-4 gap-px"
          style={{ background: "var(--bone)" }}
        >
          <Stat value="< 4 min" label="From sign-up to first class" />
          <Stat value="92%" label="Of revenue stays with you" />
          <Stat value="0" label="Plugins to install" />
          <Stat value="∞" label="Classes, series, courses" />
        </div>
      </section>

      {/* ─────────────────────────── pricing */}
      <section id="pricing" className="max-w-[1180px] mx-auto px-6 py-28">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <ScrollReveal>
            <span className="text-label">Pricing</span>
            <h2 className="text-h1 mt-2">Free until you sell.</h2>
            <p className="mt-4 text-base max-w-md" style={{ color: "var(--lichen)" }}>
              Build your storefront, upload content, share the link. When you make a sale,
              we take 8%. You keep the other 92%.
            </p>
            <Link
              href={signedIn ? "/studio" : "/sign-up"}
              className="btn btn-primary btn-lg mt-8"
            >
              {signedIn ? "Open studio" : "Start free"}
              <ArrowUpRight size={16} />
            </Link>
          </ScrollReveal>

          <ScrollReveal delay={0.1}>
            <div className="card card-pop p-8">
              <div className="flex items-baseline gap-2">
                <span
                  style={{
                    fontSize: "4rem",
                    fontWeight: 600,
                    letterSpacing: "-0.04em",
                    lineHeight: 0.9,
                    color: "var(--ink)",
                  }}
                >
                  8<span style={{ color: "var(--accent)" }}>%</span>
                </span>
                <span className="text-sm" style={{ color: "var(--lichen)" }}>
                  of revenue
                </span>
              </div>
              <ul className="mt-7 space-y-2.5">
                <Tick>Unlimited classes, series, courses</Tick>
                <Tick>Branded storefront with custom typography</Tick>
                <Tick>Subscriber library & favorites</Tick>
                <Tick>Stripe Connect when you&apos;re ready</Tick>
                <Tick>No monthly fee, no card on file</Tick>
              </ul>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ─────────────────────────── footer */}
      <footer
        style={{
          borderTop: "1px solid var(--bone)",
          background: "var(--paper)",
        }}
      >
        <div className="max-w-[1180px] mx-auto px-6 py-12 grid md:grid-cols-4 gap-8">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2">
              <span
                className="inline-block w-5 h-5 rounded-md"
                style={{ background: "var(--ink)" }}
              />
              <span className="font-medium tracking-tight">lite-hotmart</span>
            </div>
            <p className="mt-3 text-sm max-w-sm" style={{ color: "var(--lichen)" }}>
              The studio behind your studio.
            </p>
          </div>
          <div>
            <div className="text-label">Product</div>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link href="#features" style={{ color: "var(--ink)" }}>Features</Link></li>
              <li><Link href="#pricing" style={{ color: "var(--ink)" }}>Pricing</Link></li>
              <li><Link href="/dev" style={{ color: "var(--ink)" }}>Live demo</Link></li>
            </ul>
          </div>
          <div>
            <div className="text-label">Company</div>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link href="#" style={{ color: "var(--ink)" }}>Contact</Link></li>
              <li><Link href="#" style={{ color: "var(--ink)" }}>Changelog</Link></li>
            </ul>
          </div>
        </div>
        <div style={{ borderTop: "1px solid var(--bone)" }}>
          <div className="max-w-[1180px] mx-auto px-6 py-5 flex justify-between text-mono-sm" style={{ color: "var(--muted)" }}>
            <span>© 2026 lite-hotmart</span>
            <span>v0.1</span>
          </div>
        </div>
      </footer>
    </main>
  );
}

function PreviewCard({
  title,
  duration,
  locked,
}: {
  title: string;
  duration: string;
  locked?: boolean;
}) {
  return (
    <div
      className="card overflow-hidden"
      style={{ background: "var(--paper)" }}
    >
      <div
        className="relative"
        style={{
          aspectRatio: "16 / 10",
          background:
            "linear-gradient(135deg, var(--stone) 0%, var(--bone) 100%)",
        }}
      >
        {locked ? (
          <span
            className="absolute top-2.5 right-2.5 chip chip--mono"
            style={{ background: "rgba(10,10,11,0.85)", color: "var(--paper)" }}
          >
            MEMBERS
          </span>
        ) : null}
      </div>
      <div className="p-3">
        <div className="text-sm font-medium" style={{ color: "var(--ink)" }}>
          {title}
        </div>
        <div className="text-mono-sm mt-1" style={{ color: "var(--lichen)" }}>
          {duration}
        </div>
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="p-6" style={{ background: "var(--paper)" }}>
      <div
        style={{
          fontSize: "2rem",
          fontWeight: 600,
          letterSpacing: "-0.03em",
          color: "var(--ink)",
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      <div className="mt-2 text-sm" style={{ color: "var(--lichen)" }}>
        {label}
      </div>
    </div>
  );
}

function Tick({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-sm">
      <Check
        size={16}
        strokeWidth={2.25}
        className="mt-0.5 shrink-0"
        style={{ color: "var(--accent)" }}
      />
      <span style={{ color: "var(--ink)" }}>{children}</span>
    </li>
  );
}
