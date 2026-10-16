const videoIdPattern = /^[A-Za-z0-9_-]{11}$/;

export function youtubeEmbedUrl(value: string) {
  try {
    const url = new URL(value.trim());
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    const segments = url.pathname.split("/").filter(Boolean);
    let videoId: string | null = null;

    if (hostname === "youtu.be") {
      videoId = segments[0] ?? null;
    } else if (
      hostname === "youtube.com" ||
      hostname.endsWith(".youtube.com") ||
      hostname === "youtube-nocookie.com" ||
      hostname.endsWith(".youtube-nocookie.com")
    ) {
      if (url.pathname === "/watch") {
        videoId = url.searchParams.get("v");
      } else if (["embed", "shorts", "live"].includes(segments[0] ?? "")) {
        videoId = segments[1] ?? null;
      }
    }

    if (!videoId || !videoIdPattern.test(videoId)) return null;

    const embedUrl = new URL(`https://www.youtube-nocookie.com/embed/${videoId}`);
    embedUrl.searchParams.set("autoplay", "0");
    embedUrl.searchParams.set("rel", "0");
    return embedUrl.toString();
  } catch {
    return null;
  }
}
