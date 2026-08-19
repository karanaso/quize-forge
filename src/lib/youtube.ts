const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
]);

/** Parse a YouTube time parameter (e.g. "1m30s", "90", "1h") into seconds. */
function parseTimeParam(t: string): string | null {
  const trimmed = t.trim();
  const parts = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(trimmed);
  if (parts && (parts[1] || parts[2] || parts[3])) {
    const hours = Number(parts[1] ?? 0);
    const minutes = Number(parts[2] ?? 0);
    const seconds = Number(parts[3] ?? 0);
    return String(hours * 3600 + minutes * 60 + seconds);
  }
  if (/^\d+$/.test(trimmed)) return trimmed;
  return null;
}

/**
 * Convert a teacher-provided YouTube URL to a privacy-enhanced embed URL.
 * Strict: only `youtube.com/watch?v=ID` (including www./m.) and
 * `youtu.be/ID` are accepted; anything else returns null. An optional
 * timestamp (`t=`/`start=`) is preserved as `?start=N`.
 */
export function youtubeUrlToEmbed(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase();
  let id: string | null = null;
  let start: string | null = null;

  if (host === "youtu.be") {
    id = parsed.pathname.split("/").filter(Boolean)[0] ?? null;
    start = parseTimeParam(parsed.searchParams.get("t") ?? "");
  } else if (YOUTUBE_HOSTS.has(host) && parsed.pathname.replace(/\/+$/, "") === "/watch") {
    id = parsed.searchParams.get("v");
    const t = parsed.searchParams.get("t") ?? parsed.searchParams.get("start");
    start = t ? parseTimeParam(t) : null;
  }

  if (!id) return null;

  const embed = new URL(
    `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}`,
  );
  if (start) embed.searchParams.set("start", start);
  return embed.toString();
}
