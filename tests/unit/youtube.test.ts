import { describe, expect, it } from "vitest";
import { youtubeUrlToEmbed } from "@/lib/youtube";

describe("youtubeUrlToEmbed", () => {
  it("converts a youtube.com/watch?v= link", () => {
    expect(youtubeUrlToEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    );
  });

  it("accepts the bare youtube.com domain and mobile host", () => {
    expect(youtubeUrlToEmbed("https://youtube.com/watch?v=abc123xyzAB")).toBe(
      "https://www.youtube-nocookie.com/embed/abc123xyzAB",
    );
    expect(youtubeUrlToEmbed("https://m.youtube.com/watch?v=abc123xyzAB")).toBe(
      "https://www.youtube-nocookie.com/embed/abc123xyzAB",
    );
  });

  it("converts a youtu.be short link", () => {
    expect(youtubeUrlToEmbed("https://youtu.be/abc123xyzAB")).toBe(
      "https://www.youtube-nocookie.com/embed/abc123xyzAB",
    );
  });

  it("preserves a timestamp as start seconds", () => {
    expect(
      youtubeUrlToEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=90"),
    ).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=90");
    expect(
      youtubeUrlToEmbed("https://youtu.be/dQw4w9WgXcQ?t=1m30s"),
    ).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=90");
    expect(
      youtubeUrlToEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ&start=45"),
    ).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=45");
  });

  it("returns null for empty or whitespace input", () => {
    expect(youtubeUrlToEmbed("")).toBeNull();
    expect(youtubeUrlToEmbed("   ")).toBeNull();
  });

  it("returns null for non-YouTube URLs", () => {
    expect(youtubeUrlToEmbed("https://vimeo.com/12345")).toBeNull();
    expect(youtubeUrlToEmbed("https://example.com/watch?v=abc123xyzAB")).toBeNull();
    expect(youtubeUrlToEmbed("not a url")).toBeNull();
  });

  it("rejects an embed link (strict: only watch and youtu.be)", () => {
    expect(
      youtubeUrlToEmbed("https://www.youtube.com/embed/abc123xyzAB"),
    ).toBeNull();
  });

  it("returns null when the video id is missing", () => {
    expect(youtubeUrlToEmbed("https://www.youtube.com/watch")).toBeNull();
    expect(youtubeUrlToEmbed("https://youtu.be/")).toBeNull();
  });
});
