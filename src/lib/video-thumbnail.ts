import { youtubeThumbnail, vimeoId } from "@/components/video-embed";

/**
 * Resolve a poster/thumbnail image URL for a class video.
 *
 * YouTube exposes a stable by-id image URL (`img.youtube.com/vi/{id}/…`), so it
 * is derived synchronously with no network call. Vimeo has no equivalent
 * pattern — the only supported way to get a poster is its oEmbed endpoint — so
 * this is async and best-effort: any failure (network, private video, rate
 * limit, timeout) resolves to `null` and the caller keeps whatever it had
 * (usually a colored placeholder). It never throws, so it is safe to await
 * inside a studio save action without risking the whole save.
 */
export async function fetchVideoThumbnail(
  provider: "youtube" | "vimeo",
  url: string,
): Promise<string | null> {
  if (provider === "youtube") return youtubeThumbnail(url);
  if (provider !== "vimeo") return null;

  const id = vimeoId(url);
  if (!id) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const oembed =
      `https://vimeo.com/api/oembed.json` +
      `?url=${encodeURIComponent(`https://vimeo.com/${id}`)}&width=960`;
    const res = await fetch(oembed, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { thumbnail_url?: unknown };
    const thumb = data.thumbnail_url;
    return typeof thumb === "string" && thumb.startsWith("http") ? thumb : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
