import 'server-only';
import { hashPrivateValue, hashToken, randomToken, safeEqual } from '@/lib/security';
import { connectDb } from '@/lib/db';
import { env } from '@/lib/env';
import { StreamSession } from '@/models';

export function streamClientKey(headers: Headers) {
  const cookieHeader = headers.get('cookie') || '';
  const stableClientToken = cookieHeader.split(';').map((part) => part.trim()).find((part) => part.startsWith('cineseya_stream_client='))?.split('=').slice(1).join('=');
  if (stableClientToken && stableClientToken.length >= 32 && stableClientToken.length <= 200) return streamClientKeyFromToken(stableClientToken);
  const address = headers.get('cf-connecting-ip') || headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  const agent = headers.get('user-agent')?.slice(0, 300) || 'unknown';
  return hashPrivateValue(`${address}:${agent}`);
}

export function streamClientKeyFromToken(token: string) {
  return hashPrivateValue(`stream-client:${token}`);
}

export async function createStreamSession(mediaStreamId: unknown, clientKeyHash: string, userId?: string) {
  await connectDb();
  const token = randomToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + env.STREAM_SESSION_TTL_SECONDS * 1_000);
  await StreamSession.create({ tokenHash: hashToken(token), mediaStream: mediaStreamId, user: userId, clientKeyHash, expiresAt, lastAccessAt: now });
  return { token, expiresAt };
}

export async function resolveStreamSession(token: string, headers: Headers) {
  if (!token || token.length > 200) return null;
  await connectDb();
  const session = await StreamSession.findOne({ tokenHash: hashToken(token), expiresAt: { $gt: new Date() } }).select('+clientKeyHash').lean();
  if (!session || !safeEqual(String(session.clientKeyHash), streamClientKey(headers))) return null;
  const lastAccess = new Date(session.lastAccessAt as Date).getTime();
  if (Date.now() - lastAccess > 30_000) void StreamSession.updateOne({ _id: session._id }, { $set: { lastAccessAt: new Date() } }).catch(() => undefined);
  return session;
}
