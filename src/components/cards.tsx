"use client";

import { useState } from "react";
import Link from "next/link";
import { Layers, Play, GraduationCap, Lock } from "lucide-react";
import { youtubeThumbnail } from "./video-embed";
import { formatCents } from "@/lib/utils";
import { PaywallModal, type PaywallPlan } from "./paywall-modal";

export type CardPaywall = {
  creatorId: string;
  creatorName: string;
  creatorAccent: string;
  plan: PaywallPlan | null;
  signedIn: boolean;
};

/* ──────────────────────────────────────────────── Class card */

export function ClassCard({
  creatorSlug,
  cls,
  locked,
  paywall,
  category,
}: {
  creatorSlug: string;
  cls: {
    slug: string;
    title: string;
    durationMins: number | null;
    thumbnailUrl: string | null;
    videoUrl: string;
  };
  locked?: boolean;
  paywall?: CardPaywall;
  category?: string;
}) {
  const thumb = cls.thumbnailUrl || youtubeThumbnail(cls.videoUrl) || null;
  const [paywallOpen, setPaywallOpen] = useState(false);
  const interceptToPaywall = Boolean(locked && paywall);

  const inner = (
    <>
      <div
        className="relative overflow-hidden"
        style={{ aspectRatio: "16 / 10", background: "var(--stone)" }}
      >
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt=""
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : null}
        {locked ? (
          <span
            className="absolute top-2.5 right-2.5 chip"
            style={{ background: "rgba(10,10,11,0.85)", color: "var(--paper)" }}
          >
            <Lock size={11} strokeWidth={2} />
            Members
          </span>
        ) : null}
        <div
          aria-hidden
          className="absolute bottom-2.5 right-2.5 w-9 h-9 rounded-full flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
          style={{
            background: "var(--paper)",
            color: "var(--ink)",
            boxShadow: "var(--shadow-pop)",
          }}
        >
          <Play size={13} strokeWidth={2} fill="currentColor" />
        </div>
      </div>
      <div className="p-4">
        {category ? (
          <div className="text-mono-sm" style={{ color: "var(--muted)" }}>
            {category}
          </div>
        ) : null}
        <div
          className={category ? "mt-1 font-medium" : "font-medium"}
          style={{
            fontSize: "0.9375rem",
            letterSpacing: "-0.01em",
            color: "var(--ink)",
            lineHeight: 1.3,
          }}
        >
          {cls.title}
        </div>
        {cls.durationMins ? (
          <div className="mt-3 chip chip--mono chip--quiet">
            {cls.durationMins} min
          </div>
        ) : null}
      </div>
    </>
  );

  if (interceptToPaywall && paywall) {
    return (
      <>
        <button
          type="button"
          onClick={() => setPaywallOpen(true)}
          className="card card-pop hover:card-lift group block overflow-hidden transition-shadow text-left w-full"
        >
          {inner}
        </button>
        <PaywallModal
          open={paywallOpen}
          onClose={() => setPaywallOpen(false)}
          creatorId={paywall.creatorId}
          creatorName={paywall.creatorName}
          creatorAccent={paywall.creatorAccent}
          plan={paywall.plan}
          signedIn={paywall.signedIn}
        />
      </>
    );
  }

  return (
    <Link
      href={`/${creatorSlug}/practice/classes/${cls.slug}`}
      className="card card-pop hover:card-lift group block overflow-hidden transition-shadow"
    >
      {inner}
    </Link>
  );
}

/* ──────────────────────────────────────────────── Series card */

export function SeriesCard({
  creatorSlug,
  series,
  classCount,
  locked,
  category,
}: {
  creatorSlug: string;
  series: { slug: string; title: string; coverUrl: string | null };
  classCount: number;
  locked?: boolean;
  category?: string;
}) {
  return (
    <Link
      href={`/${creatorSlug}/practice/series/${series.slug}`}
      className="card card-pop hover:card-lift group block overflow-hidden transition-shadow"
    >
      <div
        className="relative overflow-hidden"
        style={{ aspectRatio: "4 / 3", background: "var(--stone)" }}
      >
        {series.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={series.coverUrl}
            alt=""
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div
            className="w-full h-full"
            style={{
              background: "linear-gradient(135deg, var(--stone), var(--bone))",
            }}
          />
        )}
        {locked ? (
          <span
            className="absolute top-2.5 right-2.5 chip"
            style={{ background: "rgba(10,10,11,0.85)", color: "var(--paper)" }}
          >
            <Lock size={11} strokeWidth={2} />
            Members
          </span>
        ) : null}
        <span
          className="absolute top-2.5 left-2.5 chip"
          style={{ background: "rgba(255,255,255,0.95)", color: "var(--ink)" }}
        >
          <Layers size={11} strokeWidth={2} />
          Series
        </span>
      </div>
      <div className="p-4">
        {category ? (
          <div className="text-mono-sm" style={{ color: "var(--muted)" }}>
            {category}
          </div>
        ) : null}
        <div
          className={category ? "mt-1 font-medium" : "font-medium"}
          style={{
            fontSize: "1rem",
            letterSpacing: "-0.01em",
            color: "var(--ink)",
            lineHeight: 1.3,
          }}
        >
          {series.title}
        </div>
        <div className="mt-3 chip chip--mono chip--quiet">
          {classCount} classes
        </div>
      </div>
    </Link>
  );
}

/* ──────────────────────────────────────────────── Course card */

export function CourseCard({
  creatorSlug,
  course,
  category,
}: {
  creatorSlug: string;
  course: {
    slug: string;
    title: string;
    eyebrow: string | null;
    coverUrl: string | null;
    priceCents: number;
    currency: string;
  };
  category?: string;
}) {
  return (
    <Link
      href={`/${creatorSlug}/courses/${course.slug}`}
      className="card card-pop hover:card-lift group block overflow-hidden transition-shadow"
    >
      <div
        className="relative overflow-hidden"
        style={{ aspectRatio: "4 / 5", background: "var(--stone)" }}
      >
        {course.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={course.coverUrl}
            alt=""
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div
            className="w-full h-full"
            style={{
              background:
                "linear-gradient(135deg, var(--accent-soft) 0%, var(--stone) 100%)",
            }}
          />
        )}
        <span
          className="absolute top-2.5 left-2.5 chip chip--accent"
        >
          <GraduationCap size={11} strokeWidth={2} />
          Course
        </span>
      </div>
      <div className="p-4">
        {category ? (
          <div className="text-mono-sm" style={{ color: "var(--muted)" }}>
            {category}
          </div>
        ) : null}
        {course.eyebrow ? (
          <div className="text-mono-sm" style={{ color: "var(--muted)" }}>
            {course.eyebrow}
          </div>
        ) : null}
        <div
          className={category || course.eyebrow ? "mt-1 font-medium" : "font-medium"}
          style={{
            fontSize: "1.0625rem",
            letterSpacing: "-0.015em",
            color: "var(--ink)",
            lineHeight: 1.25,
          }}
        >
          {course.title}
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span
            style={{
              fontSize: "1.125rem",
              fontWeight: 600,
              letterSpacing: "-0.015em",
              color: "var(--ink)",
            }}
          >
            {formatCents(course.priceCents, course.currency)}
          </span>
          <span className="text-mono-sm" style={{ color: "var(--lichen)" }}>
            one-time
          </span>
        </div>
      </div>
    </Link>
  );
}
