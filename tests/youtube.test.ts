import { describe, expect, it } from "vitest";
import { youtubeEmbedUrl } from "@/lib/youtube";

describe("youtubeEmbedUrl", () => {
  const expected =
    "https://www.youtube-nocookie.com/embed/-T7CM4di_0c?autoplay=0&rel=0";

  it.each([
    "https://youtu.be/-T7CM4di_0c",
    "https://www.youtube.com/watch?v=-T7CM4di_0c",
    "https://youtube.com/shorts/-T7CM4di_0c",
    "https://youtube.com/live/-T7CM4di_0c",
    "https://www.youtube-nocookie.com/embed/-T7CM4di_0c",
  ])("normalizes %s to the privacy-enhanced embed", (url) => {
    expect(youtubeEmbedUrl(url)).toBe(expected);
  });

  it.each([
    "https://example.com/watch?v=-T7CM4di_0c",
    "https://youtube.com/watch?v=not-a-video-id",
    "not a URL",
  ])("rejects unsupported trailer URL %s", (url) => {
    expect(youtubeEmbedUrl(url)).toBeNull();
  });
});
