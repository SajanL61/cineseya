import 'server-only';
import { env, siteUrl } from './env';
import { hashPrivateValue, safeEqual } from './security';
import { requestClientKey } from './rate-limit';

function requestOrigin(request: Request) {
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  if (forwardedHost && forwardedProto) return `${forwardedProto}://${forwardedHost}`;
  return new URL(request.url).origin;
}

export function assertSameOrigin(request: Request) {
  const supplied = request.headers.get('origin');
  if (!supplied) throw Object.assign(new Error('Request origin is required.'), { status: 403, code: 'ORIGIN_REQUIRED' });
  let origin: string;
  try { origin = new URL(supplied).origin; }
  catch { throw Object.assign(new Error('Request origin was rejected.'), { status: 403, code: 'ORIGIN_REJECTED' }); }
  const allowed = new Set([new URL(siteUrl).origin, requestOrigin(request)]);
  if (env.NODE_ENV !== 'production') allowed.add('http://localhost:4001');
  if (!allowed.has(origin)) throw Object.assign(new Error('Request origin was rejected.'), { status: 403, code: 'ORIGIN_REJECTED' });
}

export function downloadClientKey(request: Request) {
  const userAgent = request.headers.get('user-agent')?.slice(0, 300) || 'unknown';
  return hashPrivateValue(`${requestClientKey(request)}:${userAgent}`);
}

export function assertClientKey(expected: string, request: Request) {
  if (!safeEqual(expected, downloadClientKey(request))) {
    throw Object.assign(new Error('This verification session belongs to another client.'), { status: 403, code: 'VERIFICATION_CLIENT_MISMATCH' });
  }
}

export async function verifyTurnstile(token: string | undefined, request: Request) {
  if (!env.TURNSTILE_SECRET_KEY) return;
  if (!token) throw Object.assign(new Error('Complete the security challenge first.'), { status: 400, code: 'TURNSTILE_REQUIRED' });
  const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token });
  const remoteIp = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (remoteIp) body.set('remoteip', remoteIp);
  let result: { success?: boolean };
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body, signal: AbortSignal.timeout(8_000), cache: 'no-store' });
    result = await response.json() as { success?: boolean };
  } catch {
    throw Object.assign(new Error('Security verification is temporarily unavailable.'), { status: 503, code: 'TURNSTILE_UNAVAILABLE' });
  }
  if (!result.success) throw Object.assign(new Error('Security verification failed. Please try again.'), { status: 403, code: 'TURNSTILE_REJECTED' });
}
