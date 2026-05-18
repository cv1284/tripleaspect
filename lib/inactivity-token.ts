import { createHmac, timingSafeEqual } from 'crypto';

const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function secret() {
  const s = process.env.INACTIVITY_TOKEN_SECRET;
  if (!s) throw new Error('INACTIVITY_TOKEN_SECRET is not set');
  return s;
}

export function signToken(agreementId: string): string {
  const payload = Buffer.from(
    JSON.stringify({ agreementId, exp: Date.now() + TTL_MS }),
  ).toString('base64url');
  const sig = createHmac('sha256', secret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyToken(token: string): { agreementId: string } | null {
  const dot = token.lastIndexOf('.');
  if (dot === -1) return null;

  const payload = token.slice(0, dot);
  const sig     = token.slice(dot + 1);

  const expectedSig = createHmac('sha256', secret()).update(payload).digest('base64url');

  // Constant-time comparison — both buffers must be same length (base64url of sha256 always is)
  if (!timingSafeEqual(Buffer.from(sig, 'base64url'), Buffer.from(expectedSig, 'base64url'))) {
    return null;
  }

  try {
    const { agreementId, exp } = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8'),
    ) as { agreementId: string; exp: number };

    if (Date.now() > exp) return null;
    return { agreementId };
  } catch {
    return null;
  }
}
