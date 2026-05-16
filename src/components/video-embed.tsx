export function youtubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([^?&/]+)/);
  return m?.[1] ?? null;
}

export function vimeoId(url: string): string | null {
  const m = url.match(/vimeo\.com\/(\d+)/);
  return m?.[1] ?? null;
}

export function youtubeThumbnail(url: string): string | null {
  const id = youtubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
}

export function VideoEmbed({
  provider,
  url,
  className,
}: {
  provider: "youtube" | "vimeo";
  url: string;
  className?: string;
}) {
  if (provider === "youtube") {
    const id = youtubeId(url);
    if (!id) return null;
    return (
      <div className={className ?? "aspect-video w-full"}>
        <iframe
          src={`https://www.youtube.com/embed/${id}`}
          className="w-full h-full rounded-lg"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }
  const id = vimeoId(url);
  if (!id) return null;
  return (
    <div className={className ?? "aspect-video w-full"}>
      <iframe
        src={`https://player.vimeo.com/video/${id}`}
        className="w-full h-full rounded-lg"
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}
