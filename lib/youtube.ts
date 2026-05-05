// ============================================================
// Brigid.pro — YouTube URL Resolver
// Extracts 11-char video IDs from any YouTube URL format.
// ============================================================

const YT_PATTERNS: RegExp[] = [
  // Standard watch:   https://www.youtube.com/watch?v=VIDEO_ID
  /[?&]v=([a-zA-Z0-9_-]{11})/,
  // Short share:      https://youtu.be/VIDEO_ID
  /youtu\.be\/([a-zA-Z0-9_-]{11})/,
  // Embed:            https://www.youtube.com/embed/VIDEO_ID
  /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  // Shorts:           https://www.youtube.com/shorts/VIDEO_ID
  /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  // Live:             https://www.youtube.com/live/VIDEO_ID
  /youtube\.com\/live\/([a-zA-Z0-9_-]{11})/,
  // Mobile:           https://m.youtube.com/watch?v=VIDEO_ID  (covered by first)
  // Music:            https://music.youtube.com/watch?v=VIDEO_ID  (covered by first)
];

/**
 * Extracts the 11-character YouTube video ID from any supported URL format.
 * Returns null if the URL is invalid or not a recognised YouTube URL.
 */
export function extractYouTubeVideoId(url: string | null | undefined): string | null {
  if (!url) return null;

  const clean = url.trim();
  for (const pattern of YT_PATTERNS) {
    const match = clean.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

export interface EmbedOptions {
  autoplay?:       boolean;
  mute?:           boolean;
  loop?:           boolean;
  startSeconds?:   number;
  modestBranding?: boolean;
  controls?:       boolean;
}

/**
 * Builds a YouTube /embed/ URL with safe query params.
 */
export function buildYouTubeEmbedUrl(videoId: string, opts: EmbedOptions = {}): string {
  const p = new URLSearchParams({ rel: '0' });
  if (opts.autoplay)       p.set('autoplay', '1');
  if (opts.mute)           p.set('mute', '1');
  if (opts.loop)           { p.set('loop', '1'); p.set('playlist', videoId); }
  if (opts.startSeconds)   p.set('start', String(opts.startSeconds));
  if (opts.modestBranding) p.set('modestbranding', '1');
  if (opts.controls === false) p.set('controls', '0');
  return `https://www.youtube.com/embed/${videoId}?${p.toString()}`;
}

/**
 * Resolves the best available YouTube embed URL from a priority chain.
 * Priority: session_item.custom_youtube_url → exercise.custom_youtube_url → null
 */
export function resolveYouTubeEmbed(
  itemOverride:     string | null | undefined,
  exerciseOverride: string | null | undefined,
  embedOpts:        EmbedOptions = {},
): string | null {
  const url = itemOverride ?? exerciseOverride ?? null;
  const id  = extractYouTubeVideoId(url);
  if (!id) return null;
  return buildYouTubeEmbedUrl(id, embedOpts);
}

/**
 * Returns a YouTube thumbnail URL for a given video ID.
 */
export type ThumbnailQuality = 'default' | 'mq' | 'hq' | 'sd' | 'maxres';
const QUALITY_MAP: Record<ThumbnailQuality, string> = {
  default: 'default',
  mq:      'mqdefault',
  hq:      'hqdefault',
  sd:      'sddefault',
  maxres:  'maxresdefault',
};
export function buildYouTubeThumbnail(videoId: string, quality: ThumbnailQuality = 'hq'): string {
  return `https://img.youtube.com/vi/${videoId}/${QUALITY_MAP[quality]}.jpg`;
}

// ─── Tests (run via: npx tsx lib/youtube.ts) ──────────────
if (process.env.NODE_ENV !== 'production' && typeof require !== 'undefined' && require.main === module) {
  const cases: [string, string | null][] = [
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ',       'dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ',                      'dQw4w9WgXcQ'],
    ['https://www.youtube.com/embed/dQw4w9WgXcQ',         'dQw4w9WgXcQ'],
    ['https://www.youtube.com/shorts/dQw4w9WgXcQ',        'dQw4w9WgXcQ'],
    ['https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=30s',   'dQw4w9WgXcQ'],
    ['https://music.youtube.com/watch?v=dQw4w9WgXcQ',     'dQw4w9WgXcQ'],
    ['https://www.youtube.com/live/dQw4w9WgXcQ',          'dQw4w9WgXcQ'],
    ['https://www.example.com/not-youtube',               null],
    ['',                                                   null],
  ];

  let passed = 0;
  for (const [url, expected] of cases) {
    const result = extractYouTubeVideoId(url);
    const ok = result === expected;
    console.log(`${ok ? '✓' : '✗'} "${url}" → ${result} (expected ${expected})`);
    if (ok) passed++;
  }
  console.log(`\n${passed}/${cases.length} tests passed`);
}
