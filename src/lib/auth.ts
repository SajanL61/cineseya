import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { connectDb } from './db';
import { env, useDemoData } from './env';
import { resolvePublicAssetUrl } from './assets';
import { hashPrivateValue, hashToken, randomToken, safeEqual } from './security';
import { Session, User } from '@/models';
import { ROLE_PERMISSIONS, type AuthSession, type AuthUser, type Permission, type Role } from '@/types/auth';

export const SESSION_COOKIE = 'cineseya_session';
export const CSRF_COOKIE = 'cineseya_csrf';
const LEGACY_SESSION_COOKIE = 'cinerusubs_session';
const LEGACY_CSRF_COOKIE = 'cinerusubs_csrf';
const SESSION_DAYS = 30;

function effectivePermissions(role: Role, explicit: unknown): Permission[] {
  const allowed = new Set(ROLE_PERMISSIONS[role]);
  for (const permission of Array.isArray(explicit) ? explicit : []) if (typeof permission === 'string') allowed.add(permission as Permission);
  return [...allowed];
}

function userDto(document: Record<string, unknown>): AuthUser {
  const role = document.role as Role;
  return {
    id: String(document._id),
    name: String(document.name),
    displayName: String(document.displayName || document.name),
    email: String(document.email),
    role,
    permissions: effectivePermissions(role, document.permissions),
    avatarUrl: resolvePublicAssetUrl(document.avatarKey),
    locale: document.locale === 'si' ? 'si' : 'en',
  };
}

export async function createSession(userId: string, request?: Request) {
  if (useDemoData) throw Object.assign(new Error('Account services require the CineSeya.lk database.'), { status: 503, code: 'DATABASE_REQUIRED' });
  await connectDb();
  const token = randomToken();
  const csrf = randomToken(24);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await Session.create({
    tokenHash: hashToken(token), csrfHash: hashToken(csrf), user: userId, expiresAt, lastSeenAt: new Date(),
    ipHash: request ? hashPrivateValue(request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'local') : undefined,
    userAgentHash: request ? hashPrivateValue(request.headers.get('user-agent') || 'unknown') : undefined,
  });
  const store = await cookies();
  const common = { secure: env.NODE_ENV === 'production', sameSite: 'strict' as const, path: '/', expires: expiresAt, priority: 'high' as const };
  store.set(SESSION_COOKIE, token, { ...common, httpOnly: true });
  store.set(CSRF_COOKIE, csrf, { ...common, httpOnly: false });
}

export async function deleteSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value ?? store.get(LEGACY_SESSION_COOKIE)?.value;
  if (token && !useDemoData) {
    await connectDb();
    await Session.deleteOne({ tokenHash: hashToken(token) });
  }
  store.delete(SESSION_COOKIE);
  store.delete(CSRF_COOKIE);
  store.delete(LEGACY_SESSION_COOKIE);
  store.delete(LEGACY_CSRF_COOKIE);
}

async function readSession(): Promise<AuthSession | null> {
  if (useDemoData) return null;
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value ?? store.get(LEGACY_SESSION_COOKIE)?.value;
  if (!token) return null;
  await connectDb();
  const session = await Session.findOne({ tokenHash: hashToken(token), expiresAt: { $gt: new Date() } }).select('+csrfHash').lean();
  if (!session) return null;
  const user = await User.findOne({ _id: session.user, active: true }).lean();
  if (!user) return null;
  return { id: String(session._id), csrfHash: String(session.csrfHash), expiresAt: new Date(session.expiresAt as Date), user: userDto(user as Record<string, unknown>) };
}

export const currentSession = cache(readSession);
export const currentUser = cache(async () => (await readSession())?.user ?? null);

export async function requireUser(returnTo?: string) {
  const session = await readSession();
  if (!session) redirect(`/login${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`);
  return session;
}

export async function requirePermission(permission: Permission) {
  const session = await readSession();
  if (!session) throw Object.assign(new Error('Authentication is required.'), { status: 401, code: 'AUTH_REQUIRED' });
  if (!session.user.permissions.includes(permission)) throw Object.assign(new Error('You do not have permission to perform this action.'), { status: 403, code: 'FORBIDDEN' });
  return session;
}

export async function requirePagePermission(permission: Permission, returnTo: string) {
  const session = await requireUser(returnTo);
  if (!session.user.permissions.includes(permission)) redirect('/profile?error=forbidden');
  return session;
}

export async function assertMutationRequest(request: Request, session: AuthSession) {
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).origin !== new URL(env.NEXT_PUBLIC_SITE_URL).origin) {
    throw Object.assign(new Error('Request origin was rejected.'), { status: 403, code: 'ORIGIN_REJECTED' });
  }
  const supplied = request.headers.get('x-csrf-token');
  if (!supplied || !safeEqual(hashToken(supplied), session.csrfHash)) {
    throw Object.assign(new Error('The security token is missing or expired.'), { status: 403, code: 'CSRF_REJECTED' });
  }
}
