import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock, Sparkles, Smartphone, ArrowUpRight } from "lucide-react";
import { db } from "@/lib/db";
import { getOrCreateDbUser } from "@/lib/auth";
import { hasActiveSubscription } from "@/lib/entitlements";
import { LandingPlanCard } from "./_landing-plan-card";
import { BYPASS_PAYMENTS } from "@/lib/dev-auth";

export default async function CreatorLanding({
  params,
}: {
  params: Promise<{ creatorSlug: string }>;
}) {
  const { creatorSlug } = await params;
  const creator = await db.creator.findUnique({
    where: { slug: creatorSlug },
    include: { plan: true },
  });
  if (!creator) notFound();

  const viewer = await getOrCreateDbUser();
  const subscribed = viewer ? await hasActiveSubscription(viewer.id, creator.id) : false;
  // Billing is "ready" when the creator has connected Stripe, or when we're
  // running with the global bypass (dev / tests).
  const billingReady = BYPASS_PAYMENTS || creator.stripeOnboarded;

  return (
    <div>
      {/* hero */}
      <section className="max-w-[1100px] mx-auto px-6 pt-16 pb-12 text-center">
        {creator.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={creator.logoUrl}
            alt=""
            className="mx-auto reveal block object-contain"
            style={{ maxHeight: 96, maxWidth: 240 }}
          />
        ) : (
          <div
            aria-hidden
            className="mx-auto rounded-2xl reveal"
            style={{
              width: 84,
              height: 84,
              background: creator.accentColor,
            }}
          />
        )}
        {creator.bio ? (
          <p
            className="mt-6 max-w-xl mx-auto reveal reveal-delay-2"
            style={{ color: "var(--lichen)", fontSize: "1rem" }}
          >
            {creator.bio}
          </p>
        ) : null}
      </section>

      {subscribed ? (
        <section className="max-w-[1100px] mx-auto px-6 pb-20">
          <div
            className="card card-pop p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          >
            <div>
              <div className="text-label">Member access</div>
              <h2 className="text-h2 mt-1">You&apos;re in. Pick where to start.</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={`/${creator.slug}/practice`} className="btn btn-primary">
                Practice <ArrowUpRight size={14} />
              </Link>
              <Link href={`/${creator.slug}/courses`} className="btn btn-secondary">
                Courses
              </Link>
            </div>
          </div>
        </section>
      ) : creator.plan && creator.plan.active ? (
        <section className="max-w-[1100px] mx-auto px-6 pb-20">
          <div className="grid lg:grid-cols-2 gap-8 items-start">
            <div>
              <span className="text-label">Membership</span>
              <h2 className="text-h1 mt-2">
                Unlock the full studio.
              </h2>
              <ul className="mt-8 space-y-4">
                <Bullet
                  accent={creator.accentColor}
                  icon={<Lock size={15} strokeWidth={2} />}
                  title="Instant access"
                  body="Unlock all classes and series the moment you join."
                />
                <Bullet
                  accent={creator.accentColor}
                  icon={<Sparkles size={15} strokeWidth={2} />}
                  title="Reach your goals"
                  body="Progress tracking and reward badges."
                />
                <Bullet
                  accent={creator.accentColor}
                  icon={<Smartphone size={15} strokeWidth={2} />}
                  title="Practice anywhere"
                  body="Every device, wherever you go."
                />
              </ul>
            </div>

            <LandingPlanCard
              creatorId={creator.id}
              accentColor={creator.accentColor}
              plan={{
                monthlyPriceCents: creator.plan.monthlyPriceCents,
                yearlyPriceCents: creator.plan.yearlyPriceCents,
                currency: creator.plan.currency,
              }}
              signedIn={Boolean(viewer)}
              billingReady={billingReady}
            />
          </div>
        </section>
      ) : (
        <section className="max-w-xl mx-auto px-6 pb-20">
          <div className="card p-8 text-center" style={{ color: "var(--lichen)" }}>
            This creator is still setting up their plan.
          </div>
        </section>
      )}

      {/* browse hand-offs */}
      <section style={{ borderTop: "1px solid var(--bone)", background: "var(--paper)" }}>
        <div className="max-w-[1100px] mx-auto px-6 py-16 grid sm:grid-cols-2 gap-4">
          <BrowseLink
            href={`/${creator.slug}/practice`}
            label="Practice"
            body="Classes and series for every body and every hour."
          />
          <BrowseLink
            href={`/${creator.slug}/courses`}
            label="Courses"
            body="In-depth guided programs. Pay once, keep forever."
          />
        </div>
      </section>
    </div>
  );
}

function Bullet({
  accent,
  icon,
  title,
  body,
}: {
  accent: string;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <li className="flex items-start gap-3">
      <div
        className="mt-0.5 w-8 h-8 rounded-md flex items-center justify-center shrink-0"
        style={{ background: `${accent}1A`, color: accent }}
      >
        {icon}
      </div>
      <div>
        <div className="font-medium text-sm" style={{ color: "var(--ink)" }}>{title}</div>
        <div className="text-sm mt-0.5" style={{ color: "var(--lichen)" }}>{body}</div>
      </div>
    </li>
  );
}

function BrowseLink({
  href,
  label,
  body,
}: {
  href: string;
  label: string;
  body: string;
}) {
  return (
    <Link
      href={href}
      className="card card-pop hover:card-lift group p-6 flex items-center justify-between gap-4 transition-shadow"
    >
      <div>
        <div className="text-label">Browse</div>
        <div className="text-h3 mt-1">{label}</div>
        <p className="mt-2 text-sm" style={{ color: "var(--lichen)" }}>{body}</p>
      </div>
      <ArrowUpRight
        size={20}
        strokeWidth={1.75}
        className="shrink-0 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
        style={{ color: "var(--ink)" }}
      />
    </Link>
  );
}
