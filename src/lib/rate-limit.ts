import 'server-only';
import { createHash } from 'node:crypto';
import { connectDb } from './db';
import { env, useDemoData } from './env';
import { RateLimitEvent } from '@/models';

type MemoryEntry = { count: number; resetsAt: number };
const globalRateLimits = globalThis as typeof globalThis & { __cineseyaRateLimits?: Map<string, MemoryEntry> };
const memory = globalRateLimits.__cineseyaRateLimits ?? new Map<string, MemoryEntry>();
globalRateLimits.__cineseyaRateLimits = memory;

const hash = (value: string) => createHash('sha256').update(`${env.DOWNLOAD_SIGNING_SECRET}:${value}`).digest('hex');

export function requestClientKey(request: Request) {
  const forwarded = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  return hash(forwarded);
}

export async function enforceRateLimit(request: Request, action: string, limit: number, windowMs: number) {
  const keyHash = requestClientKey(request);
  const now = Date.now();
  const windowStartMs = Math.floor(now / windowMs) * windowMs;
  if (useDemoData) {
    const key = `${action}:${keyHash}:${windowStartMs}`;
    const prior = memory.get(key);
    const next = prior && prior.resetsAt > now ? { ...prior, count: prior.count + 1 } : { count: 1, resetsAt: windowStartMs + windowMs };
    memory.set(key, next);
    if (next.count > limit) throw Object.assign(new Error('Too many requests. Please try again shortly.'), { status: 429, code: 'RATE_LIMITED' });
    return;
  }
  await connectDb();
  const windowStart = new Date(windowStartMs);
  const expiresAt = new Date(windowStartMs + windowMs * 2);
  const event = await RateLimitEvent.findOneAndUpdate({ keyHash, action, windowStart }, { $inc: { count: 1 }, $setOnInsert: { expiresAt } }, { upsert: true, new: true });
  if (Number(event.count) > limit) throw Object.assign(new Error('Too many requests. Please try again shortly.'), { status: 429, code: 'RATE_LIMITED' });
}
