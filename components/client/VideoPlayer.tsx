'use client';

import React, { useState } from 'react';
import { resolveYouTubeEmbed, buildYouTubeThumbnail, extractYouTubeVideoId } from '@/lib/youtube';

interface Props {
  // Priority chain: itemOverride → exerciseOverride → defaultVideoUrl → null
  itemYouTubeUrl?:     string | null;
  exerciseYouTubeUrl?: string | null;
  defaultVideoUrl?:    string | null;
  exerciseName:        string;
  autoplay?:           boolean;
}

export default function VideoPlayer({
  itemYouTubeUrl,
  exerciseYouTubeUrl,
  defaultVideoUrl,
  exerciseName,
  autoplay = false,
}: Props) {
  const [playerReady, setPlayerReady] = useState(false);
  const [showPlayer,  setShowPlayer]  = useState(autoplay);

  // Resolve the YouTube embed URL (item override > exercise override > null)
  const embedUrl = resolveYouTubeEmbed(itemYouTubeUrl, exerciseYouTubeUrl, {
    modestBranding: true,
    controls:       true,
    ...(autoplay && { autoplay: true, mute: true }),
  });

  const youtubeId  = extractYouTubeVideoId(itemYouTubeUrl ?? exerciseYouTubeUrl ?? '');
  const thumbUrl   = youtubeId ? buildYouTubeThumbnail(youtubeId, 'hq') : null;
  const hasYouTube = !!embedUrl;
  const hasDefault = !!defaultVideoUrl;
  const hasAny     = hasYouTube || hasDefault;

  if (!hasAny) {
    return (
      <div className="w-full aspect-video rounded-xl bg-surface-3 border border-surface-border flex flex-col items-center justify-center gap-2 text-slate-600">
        <span className="text-2xl">▶</span>
        <p className="text-xs font-mono">No video available</p>
      </div>
    );
  }

  // ── YouTube player ─────────────────────────────────────
  if (hasYouTube) {
    if (!showPlayer && thumbUrl) {
      return (
        <div
          className="relative w-full aspect-video rounded-xl overflow-hidden cursor-pointer group"
          onClick={() => setShowPlayer(true)}
          role="button"
          aria-label={`Play video for ${exerciseName}`}
        >
          {/* Thumbnail */}
          <img
            src={thumbUrl}
            alt={exerciseName}
            className="w-full h-full object-cover"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          {/* Play button */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center group-hover:bg-white/20 transition-colors">
              <span className="text-white text-xl ml-1">▶</span>
            </div>
          </div>
          {/* YouTube badge */}
          <div className="absolute top-3 right-3 px-2 py-1 rounded bg-black/60 backdrop-blur-sm text-2xs font-mono text-red-400">
            YouTube
          </div>
        </div>
      );
    }

    // Embed iframe
    return (
      <div className="w-full rounded-xl overflow-hidden bg-black">
        <div className="video-wrapper">
          <iframe
            src={`${embedUrl}${!playerReady ? '' : ''}`}
            title={`${exerciseName} demonstration`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            onLoad={() => setPlayerReady(true)}
            className="rounded-xl"
          />
        </div>
        {!playerReady && (
          <div className="absolute inset-0 bg-black flex items-center justify-center rounded-xl">
            <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        )}
      </div>
    );
  }

  // ── Default GIF / hosted video fallback ───────────────
  if (hasDefault) {
    const isVideo = /\.(mp4|webm|mov)(\?|$)/i.test(defaultVideoUrl!);
    if (isVideo) {
      return (
        <div className="w-full rounded-xl overflow-hidden bg-black">
          <video
            src={defaultVideoUrl!}
            className="w-full aspect-video object-contain"
            controls
            playsInline
            preload="metadata"
            aria-label={`${exerciseName} demonstration`}
          />
        </div>
      );
    }
    // GIF
    return (
      <div className="w-full rounded-xl overflow-hidden bg-surface-3">
        <img
          src={defaultVideoUrl!}
          alt={`${exerciseName} demonstration`}
          className="w-full object-contain max-h-64"
          loading="lazy"
        />
      </div>
    );
  }

  return null;
}
