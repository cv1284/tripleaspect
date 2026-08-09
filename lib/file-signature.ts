// Server-side magic-byte checks — a client-declared File.type is just a label
// the browser sends and cannot be trusted; this inspects actual file bytes.

const ISO_BOX_TYPES = new Set(['ftyp', 'moov', 'free', 'mdat', 'wide', 'skip']);

function matchesBytes(buf: Buffer, offset: number, bytes: number[]): boolean {
  if (buf.length < offset + bytes.length) return false;
  for (let i = 0; i < bytes.length; i++) {
    if (buf[offset + i] !== bytes[i]) return false;
  }
  return true;
}

export function sniffFileType(buf: Buffer): string | null {
  if (matchesBytes(buf, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (matchesBytes(buf, 0, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (matchesBytes(buf, 0, [0x47, 0x49, 0x46, 0x38])) return 'image/gif';
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  if (matchesBytes(buf, 0, [0x1a, 0x45, 0xdf, 0xa3])) return 'video/webm';
  // MP4 and QuickTime (.mov) share the ISO base media file format box structure
  if (buf.length >= 8 && ISO_BOX_TYPES.has(buf.toString('ascii', 4, 8))) return 'video/mp4';
  return null;
}

// True when the file's actual signature is compatible with what the client declared.
export function matchesDeclaredType(buf: Buffer, declaredType: string): boolean {
  const sniffed = sniffFileType(buf);
  if (!sniffed) return false;
  if (sniffed === declaredType) return true;
  if (sniffed === 'video/mp4' && declaredType === 'video/quicktime') return true;
  return false;
}
