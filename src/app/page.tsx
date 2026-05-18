import Link from "next/link";
import { Instrument_Serif } from "next/font/google";
import {
  ArrowUpRight,
  Check,
  Play,
  Sparkles,
  Star,
  Zap,
  Layers,
  GraduationCap,
  CreditCard,
} from "lucide-react";
import { currentClerkUserId } from "@/lib/auth";
import { ScrollReveal } from "@/components/scroll-reveal";

const display = Instrument_Serif({
  weight: ["400"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-mkt-display",
  display: "swap",
});

export default async function Home() {
  const userId = await currentClerkUserId();
  const signedIn = Boolean(userId);

  return (
    <main
      className={`${display.variable} flex-1`}
      style={{
        // Marketing-only token overrides for a warmer paper feel
        ["--mkt-paper" as string]: "#F8F5EE",
        ["--mkt-surface" as string]: "#FFFFFF",
        ["--mkt-ink" as string]: "#0F0E0C",
        ["--mkt-lichen" as string]: "#6B6862",
        ["--mkt-bone" as string]: "#E7E2D5",
        ["--mkt-display" as string]: "var(--font-mkt-display)",
        background: "#F8F5EE",
      }}
    >
      {/* ─────────────────────────────────────── header */}
      <header
        className="sticky top-0 z-30"
        style={{
          background: "color-mix(in srgb, #F8F5EE 78%, transparent)",
          backdropFilter: "saturate(160%) blur(14px)",
          WebkitBackdropFilter: "saturate(160%) blur(14px)",
          borderBottom: "1px solid var(--mkt-bone)",
        }}
      >
        <div className="max-w-[1200px] mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" aria-label="Lite Creator" className="flex items-center gap-2">
            <span
              className="inline-block w-5 h-5 rounded-md"
              style={{ background: "var(--mkt-ink)" }}
              aria-hidden
            />
            <span className="font-medium tracking-tight" style={{ color: "var(--mkt-ink)" }}>
              Lite Creator
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1 text-sm">
            <NavLink href="#product">Product</NavLink>
            <NavLink href="#pricing">Pricing</NavLink>
            <NavLink href="#stories">Customers</NavLink>
            <NavLink href="https://studio.lite-creator.com" external>Live demo</NavLink>
          </nav>

          <div className="flex items-center gap-2 text-sm">
            {!signedIn ? (
              <>
                <Link
                  href="/sign-in"
                  className="px-3 py-1.5 rounded-md transition-colors"
                  style={{ color: "var(--mkt-ink)" }}
                >
                  Sign in
                </Link>
                <Link
                  href="/sign-up"
                  className="px-3.5 py-1.5 rounded-md font-medium transition-colors"
                  style={{ background: "var(--mkt-ink)", color: "var(--mkt-paper)" }}
                >
                  Start free trial
                </Link>
              </>
            ) : (
              <Link
                href="/studio"
                className="px-3.5 py-1.5 rounded-md font-medium"
                style={{ background: "var(--mkt-ink)", color: "var(--mkt-paper)" }}
              >
                Open studio
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* ─────────────────────────────────────── hero */}
      <section className="relative max-w-[1200px] mx-auto px-6 pt-24 pb-16">
        {/* decorative grid wash */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(rgba(15,14,12,0.06) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
            maskImage:
              "radial-gradient(60% 50% at 50% 0%, #000 30%, transparent 80%)",
            WebkitMaskImage:
              "radial-gradient(60% 50% at 50% 0%, #000 30%, transparent 80%)",
          }}
        />

        <div className="relative">
          <div className="reveal">
            <span
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium"
              style={{
                background: "color-mix(in srgb, var(--accent) 12%, transparent)",
                color: "var(--accent)",
              }}
            >
              <Sparkles size={12} strokeWidth={2.25} />
              New · Subscriptions + Courses + Storefront, in one studio
            </span>
          </div>

          <h1
            className="reveal reveal-delay-1 mt-6 max-w-[18ch]"
            style={{
              fontFamily: "var(--mkt-display)",
              fontSize: "clamp(3rem, 8vw, 5.75rem)",
              lineHeight: 0.98,
              letterSpacing: "-0.025em",
              color: "var(--mkt-ink)",
              fontWeight: 400,
            }}
          >
            Build a creator business
            <span
              style={{
                fontStyle: "italic",
                color: "var(--accent)",
                display: "inline-block",
                marginLeft: "0.05em",
              }}
            >
              {" "}you own.
            </span>
          </h1>

          <p
            className="reveal reveal-delay-2 mt-7 max-w-[42ch] text-lg"
            style={{ color: "var(--mkt-lichen)", lineHeight: 1.5 }}
          >
            Memberships, courses, and a branded home for the people who pay for
            what you make. No algorithms. No revenue cut. Yours.
          </p>

          <div className="reveal reveal-delay-3 mt-9 flex flex-wrap items-center gap-3">
            <Link
              href={signedIn ? "/studio" : "/sign-up"}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-md font-medium transition-transform"
              style={{
                background: "var(--mkt-ink)",
                color: "var(--mkt-paper)",
                fontSize: "0.9375rem",
              }}
            >
              {signedIn ? "Open studio" : "Start your studio"}
              <ArrowUpRight size={16} strokeWidth={2} />
            </Link>
            <Link
              href="https://studio.lite-creator.com"
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-md font-medium"
              style={{
                background: "transparent",
                color: "var(--mkt-ink)",
                border: "1px solid var(--mkt-bone)",
                fontSize: "0.9375rem",
              }}
            >
              <Play size={14} strokeWidth={2} fill="currentColor" />
              See a live storefront
            </Link>
          </div>

          <div
            className="reveal reveal-delay-4 mt-6 text-sm"
            style={{ color: "#9B9892" }}
          >
            14-day free trial · No credit card · Cancel anytime
          </div>
        </div>

        {/* hero product mock */}
        <ScrollReveal delay={0.15}>
          <div
            className="mt-20 mx-auto overflow-hidden"
            style={{
              maxWidth: 1100,
              background: "var(--mkt-surface)",
              border: "1px solid var(--mkt-bone)",
              borderRadius: 20,
              boxShadow:
                "0 30px 80px -30px rgba(15, 14, 12, 0.25), 0 10px 30px -10px rgba(15, 14, 12, 0.08)",
            }}
          >
            <BrowserChrome url="studio.litecreator.com" />
            <div className="p-8 lg:p-12 grid lg:grid-cols-[1.05fr_1fr] gap-10 items-center">
              <div>
                <div
                  className="inline-flex items-center gap-2 text-xs font-medium"
                  style={{ color: "var(--accent)" }}
                >
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full"
                    style={{ background: "var(--accent)" }}
                  />
                  Mira Yoga
                </div>
                <h3
                  className="mt-3"
                  style={{
                    fontFamily: "var(--mkt-display)",
                    fontSize: "clamp(1.875rem, 3.5vw, 2.625rem)",
                    lineHeight: 1.05,
                    letterSpacing: "-0.02em",
                    fontWeight: 400,
                    color: "var(--mkt-ink)",
                  }}
                >
                  Slow yoga, every morning.
                </h3>
                <p
                  className="mt-4 text-sm"
                  style={{ color: "var(--mkt-lichen)", lineHeight: 1.6 }}
                >
                  New classes weekly, three signature series, a 30-day course
                  for beginners. All for $30/mo.
                </p>
                <div className="mt-6 flex flex-wrap gap-2">
                  <MockPlanButton label="Monthly" price="$30" />
                  <MockPlanButton label="Yearly" price="$250" featured />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <MockClassCard title="Hips 360" duration="55 min" hue="#E6D7B8" />
                <MockClassCard title="Twist & let go" duration="31 min" hue="#D9C9D6" locked />
                <MockClassCard title="Spinal waves" duration="42 min" hue="#C9D6CC" />
                <MockClassCard title="Strong legs" duration="48 min" hue="#E2C8B5" locked />
              </div>
            </div>
          </div>
        </ScrollReveal>
      </section>

      {/* ─────────────────────────────────────── product / features */}
      <section id="product" className="max-w-[1200px] mx-auto px-6 py-32">
        <ScrollReveal>
          <div className="max-w-2xl">
            <span
              className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: "var(--accent)", letterSpacing: "0.14em" }}
            >
              The platform
            </span>
            <h2
              className="mt-4"
              style={{
                fontFamily: "var(--mkt-display)",
                fontSize: "clamp(2.25rem, 5vw, 3.5rem)",
                lineHeight: 1.05,
                letterSpacing: "-0.02em",
                fontWeight: 400,
                color: "var(--mkt-ink)",
              }}
            >
              Everything you need.{" "}
              <span style={{ fontStyle: "italic", color: "var(--accent)" }}>
                Nothing you don&apos;t.
              </span>
            </h2>
            <p
              className="mt-5 max-w-xl"
              style={{ color: "var(--mkt-lichen)", lineHeight: 1.6 }}
            >
              Memberships, courses, gating, payments, analytics — built like a
              product, not a stack of plugins.
            </p>
          </div>
        </ScrollReveal>

        <div className="mt-16 grid md:grid-cols-3 gap-5">
          {[
            {
              icon: <CreditCard size={18} strokeWidth={1.75} />,
              title: "Memberships",
              body: "One subscription, monthly and yearly. Free previews to drive conversion. Cancellations handled by Stripe.",
              bullets: ["Monthly + Yearly", "Free trials", "Drip release"],
            },
            {
              icon: <GraduationCap size={18} strokeWidth={1.75} />,
              title: "Courses & add-ons",
              body: "Sell one-time programs to your subscribers. Modular, ordered, gated — everything subscribers expect.",
              bullets: ["One-time sales", "Module structure", "Subscriber-only"],
            },
            {
              icon: <Layers size={18} strokeWidth={1.75} />,
              title: "Storefront",
              body: "A branded catalog at /you. Wears your color, your typography, your photography — not ours.",
              bullets: ["Custom domain", "SEO-ready", "Mobile-first"],
            },
          ].map((f, i) => (
            <ScrollReveal key={f.title} delay={0.05 * i}>
              <div
                className="h-full p-7 transition-shadow"
                style={{
                  background: "var(--mkt-surface)",
                  border: "1px solid var(--mkt-bone)",
                  borderRadius: 16,
                  boxShadow: "0 1px 2px rgba(15, 14, 12, 0.04)",
                }}
              >
                <div
                  className="w-10 h-10 rounded-md flex items-center justify-center"
                  style={{
                    background: "color-mix(in srgb, var(--accent) 10%, white)",
                    color: "var(--accent)",
                  }}
                >
                  {f.icon}
                </div>
                <h3
                  className="mt-5"
                  style={{
                    fontFamily: "var(--mkt-display)",
                    fontSize: "1.625rem",
                    lineHeight: 1.15,
                    letterSpacing: "-0.018em",
                    fontWeight: 400,
                    color: "var(--mkt-ink)",
                  }}
                >
                  {f.title}
                </h3>
                <p
                  className="mt-3 text-sm"
                  style={{ color: "var(--mkt-lichen)", lineHeight: 1.6 }}
                >
                  {f.body}
                </p>
                <ul className="mt-6 space-y-2">
                  {f.bullets.map((b) => (
                    <li key={b} className="flex items-center gap-2 text-sm">
                      <Check
                        size={14}
                        strokeWidth={2.25}
                        style={{ color: "var(--accent)" }}
                      />
                      <span style={{ color: "var(--mkt-ink)" }}>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* ─────────────────────────────────────── big quote section */}
      <section
        id="stories"
        style={{
          background: "var(--mkt-ink)",
          color: "#F4F0E6",
        }}
      >
        <div className="max-w-[1100px] mx-auto px-6 py-32">
          <ScrollReveal>
            <span
              className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: "#9DDC9F", letterSpacing: "0.14em" }}
            >
              From the studio of Mira Yoga
            </span>
            <blockquote
              className="mt-6 max-w-4xl"
              style={{
                fontFamily: "var(--mkt-display)",
                fontSize: "clamp(2rem, 4.5vw, 3.25rem)",
                lineHeight: 1.1,
                letterSpacing: "-0.02em",
                fontWeight: 400,
              }}
            >
              <span style={{ fontStyle: "italic", color: "#F4F0E6" }}>
                &ldquo;I used to spend two days a month building Zaps between
                MemberSpace, Mailchimp, Stripe, and Squarespace.
              </span>
              <span style={{ color: "#A5C9A2" }}>
                {" "}Now it&apos;s one tab. My subscribers get a real product,
                and I get a real business.&rdquo;
              </span>
            </blockquote>
            <footer
              className="mt-10 flex items-center gap-3 text-sm"
              style={{ color: "#A8A49B" }}
            >
              <span
                aria-hidden
                className="inline-block w-10 h-10 rounded-full"
                style={{ background: "#A5C9A2" }}
              />
              <div>
                <div style={{ color: "#F4F0E6", fontWeight: 500 }}>
                  Mira Yoga
                </div>
                <div>Yoga & somatic teacher</div>
              </div>
            </footer>
          </ScrollReveal>
        </div>
      </section>

      {/* ─────────────────────────────────────── stats / proof */}
      <section
        style={{
          borderBottom: "1px solid var(--mkt-bone)",
          background: "var(--mkt-surface)",
        }}
      >
        <div
          className="max-w-[1200px] mx-auto px-6 py-20 grid grid-cols-2 md:grid-cols-4 gap-px"
          style={{ background: "var(--mkt-bone)" }}
        >
          <Stat value="< 4 min" label="From sign-up to first class" />
          <Stat
            value="100%"
            label="Of revenue stays with you"
            accent
          />
          <Stat value="0" label="Plugins to install" />
          <Stat value="∞" label="Classes, series, courses" />
        </div>
      </section>

      {/* ─────────────────────────────────────── pricing */}
      <section id="pricing" className="max-w-[1100px] mx-auto px-6 py-32">
        <ScrollReveal>
          <div className="text-center max-w-3xl mx-auto">
            <span
              className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: "var(--accent)", letterSpacing: "0.14em" }}
            >
              Pricing
            </span>
            <h2
              className="mt-4"
              style={{
                fontFamily: "var(--mkt-display)",
                fontSize: "clamp(2.25rem, 5vw, 3.5rem)",
                lineHeight: 1.05,
                letterSpacing: "-0.02em",
                fontWeight: 400,
                color: "var(--mkt-ink)",
              }}
            >
              One price.{" "}
              <span style={{ fontStyle: "italic", color: "var(--accent)" }}>
                Everything in.
              </span>
            </h2>
            <p
              className="mt-5 max-w-xl mx-auto"
              style={{ color: "var(--mkt-lichen)", lineHeight: 1.6 }}
            >
              No revenue cuts. No tier games. No surprise add-ons. Cancel any
              time.
            </p>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={0.1}>
          <div
            className="mt-14 mx-auto overflow-hidden relative"
            style={{
              maxWidth: 540,
              background: "var(--mkt-surface)",
              border: "1px solid var(--mkt-bone)",
              borderRadius: 20,
              boxShadow:
                "0 30px 60px -30px rgba(15, 14, 12, 0.18), 0 10px 24px -10px rgba(15, 14, 12, 0.05)",
            }}
          >
            <div
              aria-hidden
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "radial-gradient(80% 60% at 100% 0%, color-mix(in srgb, var(--accent) 8%, transparent), transparent 60%)",
              }}
            />
            <div className="relative p-10">
              <div
                className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium"
                style={{
                  background: "color-mix(in srgb, var(--accent) 12%, white)",
                  color: "var(--accent)",
                }}
              >
                <Zap size={12} strokeWidth={2.25} />
                All-inclusive plan
              </div>

              <div className="mt-6 flex items-baseline gap-2">
                <span
                  style={{
                    fontFamily: "var(--mkt-display)",
                    fontSize: "clamp(4.5rem, 10vw, 6.5rem)",
                    lineHeight: 0.9,
                    letterSpacing: "-0.04em",
                    color: "var(--mkt-ink)",
                    fontWeight: 400,
                  }}
                >
                  $49
                </span>
                <span
                  className="text-base"
                  style={{ color: "var(--mkt-lichen)" }}
                >
                  / month
                </span>
              </div>
              <p className="mt-2 text-sm" style={{ color: "var(--mkt-lichen)" }}>
                Everything below. Forever. No revenue fee.
              </p>

              <ul className="mt-8 grid gap-3">
                {[
                  "Unlimited classes, series & courses",
                  "Memberships with monthly + yearly pricing",
                  "Subscriber-only one-time courses",
                  "Branded storefront on your custom domain",
                  "Stripe Connect — keep 100% of your revenue",
                  "Subscriber library, favorites & progress",
                  "Drip release & free previews",
                  "Email + login built in via Clerk",
                ].map((b) => (
                  <li key={b} className="flex items-start gap-2.5 text-sm">
                    <Check
                      size={16}
                      strokeWidth={2.25}
                      className="mt-0.5 shrink-0"
                      style={{ color: "var(--accent)" }}
                    />
                    <span style={{ color: "var(--mkt-ink)" }}>{b}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-9 flex flex-col gap-3">
                <Link
                  href={signedIn ? "/studio" : "/sign-up"}
                  className="inline-flex items-center justify-center gap-2 w-full px-5 py-3.5 rounded-md font-medium"
                  style={{
                    background: "var(--mkt-ink)",
                    color: "var(--mkt-paper)",
                    fontSize: "0.9375rem",
                  }}
                >
                  Start 14-day free trial
                  <ArrowUpRight size={16} strokeWidth={2} />
                </Link>
                <span
                  className="text-xs text-center"
                  style={{ color: "#9B9892" }}
                >
                  No card required · Cancel anytime
                </span>
              </div>
            </div>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={0.2}>
          <div className="mt-14 max-w-3xl mx-auto text-center">
            <p
              className="text-base"
              style={{ color: "var(--mkt-lichen)", lineHeight: 1.6 }}
            >
              We charge a flat monthly fee on purpose. The more you sell, the
              more <em>you</em> keep — not us.
            </p>
          </div>
        </ScrollReveal>
      </section>

      {/* ─────────────────────────────────────── final cta */}
      <section
        style={{
          borderTop: "1px solid var(--mkt-bone)",
          background: "var(--mkt-paper)",
        }}
      >
        <div className="max-w-[1100px] mx-auto px-6 py-28 text-center">
          <ScrollReveal>
            <h2
              style={{
                fontFamily: "var(--mkt-display)",
                fontSize: "clamp(2.5rem, 6vw, 4.5rem)",
                lineHeight: 1,
                letterSpacing: "-0.025em",
                fontWeight: 400,
                color: "var(--mkt-ink)",
              }}
            >
              Ready to own
              <br />
              <span style={{ fontStyle: "italic", color: "var(--accent)" }}>
                your audience?
              </span>
            </h2>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Link
                href={signedIn ? "/studio" : "/sign-up"}
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-md font-medium"
                style={{
                  background: "var(--mkt-ink)",
                  color: "var(--mkt-paper)",
                  fontSize: "0.9375rem",
                }}
              >
                {signedIn ? "Open studio" : "Start your studio"}
                <ArrowUpRight size={16} strokeWidth={2} />
              </Link>
              <Link
                href="https://studio.lite-creator.com"
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-md font-medium"
                style={{
                  background: "transparent",
                  color: "var(--mkt-ink)",
                  border: "1px solid var(--mkt-bone)",
                  fontSize: "0.9375rem",
                }}
              >
                Browse a live storefront
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ─────────────────────────────────────── footer */}
      <footer
        style={{
          borderTop: "1px solid var(--mkt-bone)",
          background: "var(--mkt-surface)",
        }}
      >
        <div className="max-w-[1200px] mx-auto px-6 py-14 grid md:grid-cols-12 gap-10">
          <div className="md:col-span-7">
            <div className="flex items-center gap-2">
              <span
                className="inline-block w-5 h-5 rounded-md"
                style={{ background: "var(--mkt-ink)" }}
              />
              <span
                className="font-medium tracking-tight"
                style={{ color: "var(--mkt-ink)" }}
              >
                Lite Creator
              </span>
            </div>
            <p
              className="mt-4 max-w-sm text-sm"
              style={{ color: "var(--mkt-lichen)", lineHeight: 1.6 }}
            >
              A home for creators who want to own their audience and run a
              calm, profitable thing. Built in 2026.
            </p>
            <div className="mt-6 flex gap-1.5">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star
                  key={i}
                  size={14}
                  fill="var(--accent)"
                  stroke="var(--accent)"
                  strokeWidth={1.5}
                />
              ))}
              <span
                className="ml-2 text-xs"
                style={{ color: "var(--mkt-lichen)" }}
              >
                Loved by independent creators
              </span>
            </div>
          </div>

          <FooterCol
            title="Product"
            items={[
              { label: "Features", href: "#product" },
              { label: "Pricing", href: "#pricing" },
              { label: "Live demo", href: "https://studio.lite-creator.com", external: true },
              { label: "Customer stories", href: "#stories" },
              { label: "Changelog", href: "#" },
            ]}
          />
        </div>
        <div style={{ borderTop: "1px solid var(--mkt-bone)" }}>
          <div
            className="max-w-[1200px] mx-auto px-6 py-5 flex flex-col sm:flex-row justify-between gap-2 text-xs"
            style={{ color: "#9B9892" }}
          >
            <span>© 2026 Lite Creator. All rights reserved.</span>
            <span>
              Set in{" "}
              <em style={{ fontFamily: "var(--mkt-display)" }}>
                Instrument Serif
              </em>{" "}
              & system grotesque · Made for serious creators
            </span>
          </div>
        </div>
      </footer>
    </main>
  );
}

/* ─────────────────────────────────────── small bits */

function NavLink({
  href,
  children,
  external,
}: {
  href: string;
  children: React.ReactNode;
  external?: boolean;
}) {
  return (
    <Link
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener" : undefined}
      className="px-3 py-1.5 rounded-md transition-colors"
      style={{ color: "var(--mkt-lichen)" }}
    >
      {children}
    </Link>
  );
}

function FooterCol({
  title,
  items,
}: {
  title: string;
  items: { label: string; href: string; external?: boolean }[];
}) {
  return (
    <div className="md:col-span-5">
      <div
        className="text-xs font-semibold uppercase tracking-widest"
        style={{ color: "var(--mkt-lichen)", letterSpacing: "0.12em" }}
      >
        {title}
      </div>
      <ul className="mt-4 space-y-2.5">
        {items.map((it) => (
          <li key={it.label}>
            <Link
              href={it.href}
              target={it.external ? "_blank" : undefined}
              rel={it.external ? "noopener" : undefined}
              className="text-sm hover:underline"
              style={{ color: "var(--mkt-ink)", textUnderlineOffset: 3 }}
            >
              {it.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BrowserChrome({ url }: { url: string }) {
  return (
    <div
      className="flex items-center justify-between gap-3 px-5 py-3"
      style={{
        borderBottom: "1px solid var(--mkt-bone)",
        background: "color-mix(in srgb, var(--mkt-paper) 60%, white)",
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="block w-2.5 h-2.5 rounded-full"
          style={{ background: "#E07165" }}
        />
        <span
          className="block w-2.5 h-2.5 rounded-full"
          style={{ background: "#E5BB58" }}
        />
        <span
          className="block w-2.5 h-2.5 rounded-full"
          style={{ background: "#7CB97F" }}
        />
      </div>
      <span
        className="text-xs px-3 py-1 rounded-md"
        style={{
          background: "white",
          border: "1px solid var(--mkt-bone)",
          color: "var(--mkt-lichen)",
          fontFamily:
            'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
        }}
      >
        {url}
      </span>
      <span style={{ width: 36 }} />
    </div>
  );
}

function MockPlanButton({
  label,
  price,
  featured,
}: {
  label: string;
  price: string;
  featured?: boolean;
}) {
  return (
    <span
      className="inline-flex items-center justify-between gap-3 px-3.5 py-2 rounded-md"
      style={{
        background: featured ? "var(--mkt-ink)" : "white",
        color: featured ? "var(--mkt-paper)" : "var(--mkt-ink)",
        border: featured ? "1px solid var(--mkt-ink)" : "1px solid var(--mkt-bone)",
        fontSize: "0.8125rem",
        fontWeight: 500,
        minWidth: 130,
      }}
    >
      <span>{label}</span>
      <span style={{ fontWeight: 600 }}>{price}</span>
    </span>
  );
}

function MockClassCard({
  title,
  duration,
  hue,
  locked,
}: {
  title: string;
  duration: string;
  hue: string;
  locked?: boolean;
}) {
  return (
    <div
      style={{
        background: "white",
        border: "1px solid var(--mkt-bone)",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          aspectRatio: "16 / 10",
          background: hue,
          position: "relative",
        }}
      >
        {locked ? (
          <span
            className="absolute top-2 right-2 text-[10px] px-2 py-0.5 rounded-full font-medium"
            style={{ background: "rgba(15,14,12,0.85)", color: "white" }}
          >
            Members
          </span>
        ) : null}
        <span
          className="absolute bottom-2 right-2 w-7 h-7 rounded-full flex items-center justify-center"
          style={{
            background: "white",
            color: "var(--mkt-ink)",
            boxShadow: "0 4px 12px -4px rgba(0,0,0,0.2)",
          }}
        >
          <Play size={11} strokeWidth={2} fill="currentColor" />
        </span>
      </div>
      <div className="px-3 py-2.5">
        <div
          className="text-sm font-medium truncate"
          style={{ color: "var(--mkt-ink)" }}
        >
          {title}
        </div>
        <div
          className="text-[11px] mt-0.5"
          style={{ color: "var(--mkt-lichen)" }}
        >
          {duration}
        </div>
      </div>
    </div>
  );
}

function Stat({
  value,
  label,
  accent,
}: {
  value: string;
  label: string;
  accent?: boolean;
}) {
  return (
    <div
      className="p-6 lg:p-8"
      style={{ background: "var(--mkt-surface)" }}
    >
      <div
        style={{
          fontFamily: "var(--mkt-display)",
          fontSize: "clamp(2.25rem, 4vw, 3rem)",
          lineHeight: 0.95,
          letterSpacing: "-0.03em",
          color: accent ? "var(--accent)" : "var(--mkt-ink)",
          fontStyle: accent ? "italic" : "normal",
          fontWeight: 400,
        }}
      >
        {value}
      </div>
      <div
        className="mt-3 text-sm"
        style={{ color: "var(--mkt-lichen)", lineHeight: 1.5 }}
      >
        {label}
      </div>
    </div>
  );
}
