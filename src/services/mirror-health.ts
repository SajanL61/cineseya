import 'server-only';
import { isIP } from 'node:net';
import { lookup } from 'node:dns/promises';
import { assertSafeMirrorUrl } from '@/lib/validation/media';

type MirrorLike = { url: unknown; active?: unknown };
export type MirrorHealthResult = { healthStatus: 'online' | 'slow' | 'offline' | 'disabled'; latencyMs: number };

function isPrivateAddress(address: string) {
  if (isIP(address) === 4) {
    const octets = address.split('.').map(Number);
    return octets[0] === 10 || octets[0] === 127 || (octets[0] === 169 && octets[1] === 254) || (octets[0] === 192 && octets[1] === 168) || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) || address === '0.0.0.0';
  }
  if (isIP(address) === 6) {
    const normalized = address.toLocaleLowerCase();
    return normalized === '::' || normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') || /^fe[89ab]/.test(normalized) || normalized.startsWith('::ffff:127.') || normalized.startsWith('::ffff:10.') || normalized.startsWith('::ffff:192.168.');
  }
  return true;
}

export async function assertPublicMirrorTarget(value: string) {
  const url = assertSafeMirrorUrl(value);
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(hostname)) {
    if (isPrivateAddress(hostname)) throw Object.assign(new Error('Mirror URLs cannot target private or local networks.'), { status: 400, code: 'UNSAFE_MIRROR_URL' });
    return url;
  }
  let addresses: { address: string }[];
  try { addresses = await lookup(hostname, { all: true, verbatim: true }); }
  catch { throw Object.assign(new Error('The mirror hostname could not be resolved.'), { status: 400, code: 'MIRROR_DNS_FAILED' }); }
  if (!addresses.length || addresses.some((entry) => isPrivateAddress(entry.address))) {
    throw Object.assign(new Error('Mirror URLs cannot resolve to private or local networks.'), { status: 400, code: 'UNSAFE_MIRROR_URL' });
  }
  return url;
}

export async function checkMirrorHealth(mirror: MirrorLike): Promise<MirrorHealthResult> {
  if (mirror.active === false) return { healthStatus: 'disabled', latencyMs: 0 };
  const url = await assertPublicMirrorTarget(String(mirror.url));
  const startedAt = performance.now();
  try {
    let response = await fetch(url, { method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(8_000), cache: 'no-store' });
    if (response.status === 405 || response.status === 501) {
      response = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-0' }, redirect: 'manual', signal: AbortSignal.timeout(8_000), cache: 'no-store' });
      await response.body?.cancel();
    }
    const latencyMs = Math.max(0, Math.round(performance.now() - startedAt));
    const reachable = response.status >= 200 && response.status < 500;
    return { healthStatus: reachable ? (latencyMs > 2_500 ? 'slow' : 'online') : 'offline', latencyMs };
  } catch {
    return { healthStatus: 'offline', latencyMs: Math.max(0, Math.round(performance.now() - startedAt)) };
  }
}
