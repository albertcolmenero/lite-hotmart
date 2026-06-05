import Link from "next/link";
import { Suspense } from "react";
import { Check } from "lucide-react";
import { getCreatorForCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatCents } from "@/lib/utils";
import { toPlanDisplay } from "@/lib/plan-display";
import { publishCreatorAction, unpublishCreatorAction } from "./actions";
import { PublishCelebration } from "./_celebration";

export default async function PublishPage() {
  const creator = (await getCreatorForCurrentUser())!;

  const [plan, classCount, seriesCount, courseCount] = await Promise.all([
    db.plan.findUnique({ where: { creatorId: creator.id }, include: { prices: true } }),
    db.class.count({ where: { creatorId: creator.id, published: true } }),
    db.series.count({ where: { creatorId: creator.id, published: true } }),
    db.course.count({ where: { creatorId: creator.id, published: true } }),
  ]);

  const planDisplay = toPlanDisplay(plan);
  const planSet = Boolean(planDisplay && planDisplay.options.length > 0);
  const hasContent = classCount + seriesCount + courseCount > 0;

  return (
    <div className="max-w-2xl space-y-7">
      <Suspense fallback={null}>
        <PublishCelebration creatorName={creator.displayName} />
      </Suspense>

      <header>
        <h1 className="text-h1">
          {creator.published ? "You're live." : "Publish your profile."}
        </h1>
        <p className="mt-1.5" style={{ color: "var(--lichen)" }}>
          {creator.published ? (
            creator.customDomain && creator.customDomainStatus === "active" ? (
              <>
                Visitors can find you at{" "}
                <a
                  href={`https://${creator.customDomain}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium hover:underline"
                  style={{ color: "var(--ink)" }}
                >
                  {creator.customDomain}
                </a>
                .
              </>
            ) : (
              <>Visitors can find you at /{creator.slug}.</>
            )
          ) : (
            <>When you publish, your profile becomes visible at /{creator.slug}.</>
          )}
        </p>
      </header>

      <ChecklistItem
        done={Boolean(creator.displayName && creator.slug)}
        title="Profile basics"
        body="Display name, slug, bio."
        cta={{ label: "Edit", href: "/studio/branding" }}
      />

      <ChecklistItem
        done={planSet}
        optional
        title="Subscription plan"
        body={
          planDisplay && planSet
            ? planDisplay.options
                .map((o) => `${o.label} ${formatCents(o.priceCents, planDisplay.currency)}`)
                .join(" · ")
            : "Set a price for at least one billing cadence."
        }
        cta={{ label: "Manage plan", href: "/studio/plan" }}
      />

      <ChecklistItem
        done={hasContent}
        optional
        title="At least one class, series, or course"
        body={`${classCount} classes · ${seriesCount} series · ${courseCount} courses`}
        cta={{ label: "Add content", href: "/studio/classes/new" }}
      />

      <div
        className="p-6 rounded-xl"
        style={{
          background: "var(--ink)",
          color: "var(--paper)",
          borderRadius: "var(--radius-lg)",
        }}
      >
        <h2 className="text-h3" style={{ color: "var(--paper)" }}>
          {creator.published ? "Take it offline" : "Ready to go live"}
        </h2>
        <p className="mt-1.5 text-sm" style={{ color: "var(--bone)" }}>
          {creator.published
            ? "Unpublishing hides your storefront; existing subscribers keep access."
            : "Your profile will appear at the public URL. Stripe is not required."}
        </p>

        <div className="mt-5 flex items-center gap-3">
          {!creator.published ? (
            <form action={publishCreatorAction}>
              <button type="submit" className="btn btn-accent">
                Publish profile
              </button>
            </form>
          ) : (
            <form action={unpublishCreatorAction}>
              <button
                type="submit"
                className="btn"
                style={{
                  background: "transparent",
                  color: "var(--paper)",
                  border: "1px solid var(--lichen)",
                }}
              >
                Unpublish
              </button>
            </form>
          )}

          <Link
            href={`/${creator.slug}`}
            target="_blank"
            className="text-sm hover:underline"
            style={{
              color: "var(--bone)",
              textUnderlineOffset: 3,
            }}
          >
            Preview as visitor →
          </Link>
        </div>
      </div>
    </div>
  );
}

function ChecklistItem({
  done,
  title,
  body,
  cta,
  optional,
}: {
  done: boolean;
  title: string;
  body: string;
  cta: { label: string; href: string };
  optional?: boolean;
}) {
  return (
    <div className="card p-4 flex items-start gap-3">
      <div
        className="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0"
        style={{
          background: done ? "var(--moss)" : "transparent",
          border: done ? "1px solid var(--moss)" : "1px solid var(--bone)",
          color: "#fff",
        }}
      >
        {done ? <Check size={12} strokeWidth={2.5} /> : null}
      </div>
      <div className="flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium" style={{ color: "var(--ink)" }}>{title}</span>
          {optional ? (
            <span className="text-xs" style={{ color: "var(--muted)" }}>optional</span>
          ) : null}
        </div>
        <div className="mt-0.5 text-sm" style={{ color: "var(--lichen)" }}>{body}</div>
      </div>
      <Link
        href={cta.href}
        className="text-sm font-medium hover:underline shrink-0"
        style={{ color: "var(--ink)" }}
      >
        {cta.label}
      </Link>
    </div>
  );
}
