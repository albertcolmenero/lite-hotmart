import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getOrCreateDbUser } from "@/lib/auth";
import { canPlayClass } from "@/lib/entitlements";
import { toPlanDisplay } from "@/lib/plan-display";
import { VideoEmbed, youtubeThumbnail } from "@/components/video-embed";
import { StartButton } from "@/components/start-button";

export default async function ClassDetailPage({
  params,
}: {
  params: Promise<{ creatorSlug: string; classSlug: string }>;
}) {
  const { creatorSlug, classSlug } = await params;
  const creator = await db.creator.findUnique({
    where: { slug: creatorSlug },
    include: { plan: { include: { prices: true } } },
  });
  if (!creator) notFound();

  const cls = await db.class.findUnique({
    where: { creatorId_slug: { creatorId: creator.id, slug: classSlug } },
    include: { tags: true },
  });
  if (!cls || !cls.published) notFound();

  const viewer = await getOrCreateDbUser();
  const access = await canPlayClass({ userId: viewer?.id ?? null, classId: cls.id });
  const isOwner = viewer?.id === creator.userId;
  if (!cls.standalone && !isOwner) notFound();
  if (!cls.visibleToPublic && !access.allowed && !isOwner) notFound();

  const thumb = cls.thumbnailUrl || youtubeThumbnail(cls.videoUrl);

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">
      <div>
        <div className="text-mono-sm" style={{ color: "var(--muted)" }}>
          Class
        </div>
        <h1 className="text-h1 mt-2" style={{ color: "var(--ink)" }}>
          {cls.title}
        </h1>
      </div>

      <div>
        {access.allowed ? (
          <div
            className="overflow-hidden card"
            style={{ borderRadius: "var(--radius-lg)" }}
          >
            <VideoEmbed provider={cls.videoProvider} url={cls.videoUrl} />
          </div>
        ) : (
          <div
            className="relative overflow-hidden card"
            style={{
              aspectRatio: "16 / 9",
              background: "var(--stone)",
            }}
          >
            {thumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={thumb}
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
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
          </div>
        )}
      </div>

      {cls.description ? (
        <p
          className="whitespace-pre-wrap"
          style={{
            fontSize: "1rem",
            lineHeight: 1.65,
            color: "var(--ink)",
          }}
        >
          {cls.description}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-1.5">
        {cls.durationMins ? (
          <span className="chip chip--mono chip--outline">{cls.durationMins} min</span>
        ) : null}
        {cls.tags.map((t) => (
          <span key={t.id} className="chip chip--outline">{t.name}</span>
        ))}
      </div>

      <div className="pt-2">
        <StartButton
          allowed={access.allowed}
          signedIn={Boolean(viewer)}
          creator={{ id: creator.id, displayName: creator.displayName, accentColor: creator.accentColor, slug: creator.slug }}
          plan={toPlanDisplay(creator.plan)}
          label={access.allowed ? "Start class" : "Unlock to start"}
        />
      </div>
    </div>
  );
}
