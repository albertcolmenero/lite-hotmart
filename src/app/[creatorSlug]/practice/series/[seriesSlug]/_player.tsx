"use client";

import { useState } from "react";
import { Lock, Play } from "lucide-react";
import type { VideoProvider } from "@prisma/client";
import { VideoEmbed, youtubeThumbnail } from "@/components/video-embed";
import {
  PaywallModal,
  type PaywallPlan,
} from "@/components/paywall-modal";

export type SeriesClassRow = {
  id: string;
  slug: string;
  title: string;
  videoProvider: VideoProvider;
  videoUrl: string;
  thumbnailUrl: string | null;
  durationMins: number | null;
  freeForEveryone: boolean;
};

export type SeriesPlayerPaywall = {
  creatorId: string;
  creatorName: string;
  creatorAccent: string;
  plan: PaywallPlan | null;
  signedIn: boolean;
};

export function SeriesPlayer({
  classes,
  baseAllowed,
  seriesFreeForEveryone,
  paywall,
  description,
  tags,
  coverUrl,
}: {
  classes: SeriesClassRow[];
  /** Subscribed viewer or the creator previewing — can play anything. */
  baseAllowed: boolean;
  /** Series.freeForEveryone — needed for the free-chain shortcut. */
  seriesFreeForEveryone: boolean;
  paywall: SeriesPlayerPaywall;
  description: string | null;
  tags: { id: string; name: string }[];
  coverUrl: string | null;
}) {
  // Rule: a class plays on this page only if the viewer is subscribed/owner,
  // OR both the series AND the class are marked freeForEveryone.
  const canPlay = (c: SeriesClassRow): boolean =>
    baseAllowed || (seriesFreeForEveryone && c.freeForEveryone);

  const [selectedId, setSelectedId] = useState<string | null>(
    classes[0]?.id ?? null,
  );
  const [paywallOpen, setPaywallOpen] = useState(false);
  const selected =
    classes.find((c) => c.id === selectedId) ?? classes[0] ?? null;
  const selectedPlayable = selected ? canPlay(selected) : false;
  const heroThumb =
    coverUrl ||
    (selected ? youtubeThumbnail(selected.videoUrl) : null) ||
    null;

  const handleSelect = (c: SeriesClassRow) => {
    if (!canPlay(c)) {
      setPaywallOpen(true);
      return;
    }
    setSelectedId(c.id);
  };

  return (
    <>
      <div className="grid lg:grid-cols-[1.1fr_1fr] gap-10">
        {/* LEFT — player */}
        <div className="space-y-5">
          {selectedPlayable && selected ? (
            <div
              className="overflow-hidden card"
              style={{ borderRadius: "var(--radius-lg)" }}
            >
              <VideoEmbed
                provider={selected.videoProvider}
                url={selected.videoUrl}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setPaywallOpen(true)}
              aria-label="Unlock to play"
              className="relative block w-full overflow-hidden card"
              style={{
                aspectRatio: "16 / 10",
                background: "var(--stone)",
              }}
            >
              {heroThumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={heroThumb}
                  alt=""
                  className="w-full h-full object-cover"
                  style={{ filter: "saturate(0.85) brightness(0.75)" }}
                />
              ) : null}
              <div className="absolute inset-0 flex items-center justify-center">
                <div
                  aria-hidden
                  className="w-16 h-16 rounded-full flex items-center justify-center"
                  style={{
                    background: "var(--paper)",
                    color: "var(--ink)",
                    boxShadow: "var(--shadow-pop)",
                  }}
                >
                  <Play size={20} strokeWidth={2} fill="currentColor" />
                </div>
              </div>
            </button>
          )}

          {selected ? (
            <div className="text-sm" style={{ color: "var(--lichen)" }}>
              Now playing ·{" "}
              <span style={{ color: "var(--ink)", fontWeight: 500 }}>
                {selected.title}
              </span>
              {selected.durationMins ? (
                <span style={{ color: "var(--muted)" }}>
                  {" "}
                  · {selected.durationMins} min
                </span>
              ) : null}
            </div>
          ) : null}

          {description ? (
            <div className="card p-5">
              <p
                className="whitespace-pre-wrap"
                style={{
                  fontSize: "0.9375rem",
                  lineHeight: 1.6,
                  color: "var(--ink)",
                }}
              >
                {description}
              </p>
              {tags.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {tags.map((t) => (
                    <span key={t.id} className="chip chip--outline">
                      {t.name}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* RIGHT — class list */}
        <div>
          <div className="flex items-end justify-between mb-3">
            <h2 className="text-h3">Series content</h2>
            <span
              className="text-mono-sm"
              style={{ color: "var(--lichen)" }}
            >
              {classes.length} classes
            </span>
          </div>
          <ul className="card overflow-hidden">
            {classes.map((c, i) => {
              const thumb = c.thumbnailUrl || youtubeThumbnail(c.videoUrl);
              const isSelected = selected?.id === c.id;
              const playable = canPlay(c);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(c)}
                    className="w-full text-left flex items-center gap-4 px-4 py-3 group transition-colors hover:bg-[color:var(--surface)]"
                    style={{
                      ...(i > 0
                        ? { borderTop: "1px solid var(--bone)" }
                        : {}),
                      background: isSelected
                        ? "var(--surface)"
                        : undefined,
                    }}
                  >
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-mono-sm"
                      style={{
                        background: isSelected
                          ? "var(--accent)"
                          : "var(--surface)",
                        color: isSelected ? "var(--paper)" : "var(--lichen)",
                      }}
                    >
                      {i + 1}
                    </div>
                    <div
                      className="relative w-20 h-12 overflow-hidden shrink-0"
                      style={{
                        background: "var(--stone)",
                        borderRadius: "var(--radius-sm)",
                      }}
                    >
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={thumb}
                          alt=""
                          className="w-full h-full object-cover"
                          style={
                            playable
                              ? undefined
                              : { filter: "saturate(0.7) brightness(0.85)" }
                          }
                        />
                      ) : null}
                      <div className="absolute inset-0 flex items-center justify-center">
                        {playable ? (
                          <Play
                            size={14}
                            strokeWidth={2}
                            fill="currentColor"
                            className="text-white"
                            style={{
                              filter:
                                "drop-shadow(0 1px 2px rgba(0,0,0,0.5))",
                            }}
                          />
                        ) : (
                          <Lock
                            size={14}
                            strokeWidth={2}
                            className="text-white"
                            style={{
                              filter:
                                "drop-shadow(0 1px 2px rgba(0,0,0,0.5))",
                            }}
                          />
                        )}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div
                        className="font-medium truncate text-sm"
                        style={{
                          color: isSelected
                            ? "var(--accent)"
                            : "var(--ink)",
                        }}
                      >
                        {c.title}
                      </div>
                      <div
                        className="mt-0.5 flex items-center gap-2 text-mono-sm"
                        style={{ color: "var(--lichen)" }}
                      >
                        {c.durationMins ? (
                          <span>{c.durationMins} min</span>
                        ) : null}
                        {!playable ? (
                          <span style={{ color: "var(--muted)" }}>
                            Members
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

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
