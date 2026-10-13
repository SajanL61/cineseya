import 'server-only';
import { isValidObjectId } from 'mongoose';
import { connectDb } from '@/lib/db';
import { r2BucketKindFromName, inspectObject, r2Configured } from '@/lib/r2';
import { hashPrivateValue, randomToken } from '@/lib/security';
import { assertClientKey, assertSameOrigin, downloadClientKey, verifyTurnstile } from '@/lib/request-security';
import { DownloadMirror, DownloadVerificationSession } from '@/models';
import { getDownloadPageData, resolveAuthorizedMediaVersion } from '@/services/downloads';
import { checkMirrorHealth } from '@/services/mirror-health';
import { assertVerificationOrder } from '@/lib/download-verification-state';

const SESSION_TTL_MS = 10 * 60_000;

type LeanRecord = Record<string, unknown>;

function unavailable(message: string, code = 'DOWNLOAD_UNAVAILABLE', status = 503) {
  return Object.assign(new Error(message), { status, code });
}

function sessionTokenHash(token: string) {
  return hashPrivateValue(`download-verification:${token}`);
}

function readyTokenHash(token: string) {
  return hashPrivateValue(`download-ready:${token}`);
}

async function verifyDirect(version: LeanRecord, asset: LeanRecord) {
  if (!r2Configured('media')) throw unavailable('CineSeya Direct is temporarily unavailable. Choose an active mirror.');
  const expectedSize = Number(version.fileSize ?? 0);
  const assetSize = Number(asset.size ?? expectedSize);
  if (!expectedSize || (assetSize && assetSize !== expectedSize)) throw unavailable('The stored file metadata does not match this media version.', 'FILE_SIZE_MISMATCH', 409);
  let head;
  try { head = await inspectObject(String(asset.objectKey), r2BucketKindFromName(asset.bucket)); }
  catch { throw unavailable('CineSeya Direct could not confirm the stored file. Try an active mirror.'); }
  if (Number(head.ContentLength ?? expectedSize) !== expectedSize) throw unavailable('The stored file size could not be verified.', 'FILE_SIZE_MISMATCH', 409);
  return { providerType: 'direct' as const, serverName: 'CineSeya Direct', serverStatus: 'online' as const };
}

async function verifiedMirror(mediaVersionId: string, mirrorId: string, runHealthCheck = true) {
  if (!isValidObjectId(mirrorId)) throw unavailable('The selected mirror was not found.', 'MIRROR_NOT_FOUND', 404);
  const mirror = await DownloadMirror.findOne({ _id: mirrorId, mediaVersion: mediaVersionId, active: true }).select('+url').lean();
  if (!mirror) throw unavailable('The selected mirror is disabled or unavailable.', 'MIRROR_UNAVAILABLE', 404);
  let healthStatus = String(mirror.healthStatus ?? 'unknown');
  if (runHealthCheck) {
    const result = await checkMirrorHealth(mirror as unknown as LeanRecord & { url: unknown });
    healthStatus = result.healthStatus;
    await DownloadMirror.updateOne({ _id: mirror._id }, {
      $set: { healthStatus, latencyMs: result.latencyMs, lastCheckedAt: new Date(), ...(healthStatus === 'online' || healthStatus === 'slow' ? { lastSuccessfulAt: new Date(), failureCount: 0 } : {}) },
      ...(healthStatus === 'offline' ? { $inc: { failureCount: 1 } } : {}),
    });
  }
  if (healthStatus === 'offline' || healthStatus === 'disabled' || healthStatus === 'unavailable') throw unavailable(`${String(mirror.providerName)} is currently unavailable. Choose another server.`, 'MIRROR_OFFLINE');
  return { mirror, providerType: String(mirror.providerType), serverName: String(mirror.label || mirror.providerName), serverStatus: healthStatus === 'slow' ? 'slow' as const : 'online' as const };
}

async function verificationSession(token: string, request: Request) {
  if (!token || token.length > 200) throw unavailable('The verification session is invalid.', 'INVALID_VERIFICATION_SESSION', 403);
  await connectDb();
  const session = await DownloadVerificationSession.findOne({ tokenHash: sessionTokenHash(token), expiresAt: { $gt: new Date() } }).select('+clientKeyHash').lean();
  if (!session) throw unavailable('The verification session expired. Start again.', 'VERIFICATION_EXPIRED', 410);
  assertClientKey(String(session.clientKeyHash), request);
  return session as LeanRecord;
}

export async function verifyDownloadFile(request: Request, mediaVersionId: string, mirrorId?: string) {
  assertSameOrigin(request);
  const { version, asset } = await resolveAuthorizedMediaVersion(mediaVersionId);
  const server = mirrorId ? await verifiedMirror(mediaVersionId, mirrorId) : await verifyDirect(version as LeanRecord, asset as LeanRecord);
  const token = randomToken();
  const now = new Date();
  await DownloadVerificationSession.create({
    tokenHash: sessionTokenHash(token), mediaVersion: version._id, mirror: mirrorId || undefined, providerType: server.providerType,
    clientKeyHash: downloadClientKey(request), step1CompletedAt: now, expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
  });
  return { verified: true, sessionToken: token, quality: String(version.quality), fileSize: Number(version.fileSize), serverName: server.serverName, serverStatus: server.serverStatus, expiresAt: new Date(now.getTime() + SESSION_TTL_MS).toISOString() };
}

export async function verifyDownloadSecurity(request: Request, token: string, turnstileToken?: string) {
  assertSameOrigin(request);
  const session = await verificationSession(token, request);
  assertVerificationOrder(session as unknown as { step1CompletedAt?: unknown; step2CompletedAt?: unknown; step3CompletedAt?: unknown; expiresAt: Date }, 'security');
  await verifyTurnstile(turnstileToken, request);
  const completedAt = new Date();
  await DownloadVerificationSession.updateOne({ _id: session._id, step1CompletedAt: { $exists: true }, expiresAt: { $gt: completedAt } }, { $set: { step2CompletedAt: completedAt } });
  return { verified: true };
}

export async function generateReadyDownload(request: Request, token: string) {
  assertSameOrigin(request);
  const session = await verificationSession(token, request);
  assertVerificationOrder(session as unknown as { step1CompletedAt?: unknown; step2CompletedAt?: unknown; step3CompletedAt?: unknown; expiresAt: Date }, 'generate');
  const { version, asset } = await resolveAuthorizedMediaVersion(String(session.mediaVersion));
  if (session.mirror) await verifiedMirror(String(version._id), String(session.mirror));
  else await verifyDirect(version as LeanRecord, asset as LeanRecord);
  const readyToken = randomToken();
  const completedAt = new Date();
  const result = await DownloadVerificationSession.updateOne(
    { _id: session._id, step1CompletedAt: { $exists: true }, step2CompletedAt: { $exists: true }, expiresAt: { $gt: completedAt } },
    { $set: { step3CompletedAt: completedAt, readyTokenHash: readyTokenHash(readyToken) } },
  );
  if (!result.modifiedCount) throw unavailable('The verification session expired. Start again.', 'VERIFICATION_EXPIRED', 410);
  return { verified: true, next: `/download/ready/${readyToken}` };
}

export async function getReadyDownloadData(token: string) {
  if (!token || token.length > 200) return null;
  await connectDb();
  const session = await DownloadVerificationSession.findOne({ readyTokenHash: readyTokenHash(token), step3CompletedAt: { $exists: true }, expiresAt: { $gt: new Date() } }).lean();
  if (!session) return null;
  const data = await getDownloadPageData(String(session.mediaVersion));
  if (!data) return null;
  return { ...data, readyToken: token, selectedMirrorId: session.mirror ? String(session.mirror) : undefined, providerType: String(session.providerType) };
}

export async function authorizeReadyDownload(request: Request, token: string, mediaVersionId: string, mirrorId?: string) {
  if (!token || token.length > 200) throw unavailable('The secure download link is invalid.', 'INVALID_READY_TOKEN', 403);
  await connectDb();
  const session = await DownloadVerificationSession.findOne({ readyTokenHash: readyTokenHash(token), mediaVersion: mediaVersionId, step3CompletedAt: { $exists: true }, expiresAt: { $gt: new Date() } }).select('+clientKeyHash').lean();
  if (!session) throw unavailable('Secure download link expired. Generate a new link.', 'READY_LINK_EXPIRED', 410);
  assertClientKey(String(session.clientKeyHash), request);
  const resolved = await resolveAuthorizedMediaVersion(mediaVersionId);
  if (mirrorId) await verifiedMirror(mediaVersionId, mirrorId, false);
  else await verifyDirect(resolved.version as LeanRecord, resolved.asset as LeanRecord);
  return { ...resolved, session };
}
