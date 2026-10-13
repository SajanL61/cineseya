import 'server-only';
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from './env';

export type DownloadTokenPayload = {
  mediaVersionId: string;
  objectKey: string;
  bucket: string;
  fileName: string;
  contentType: string;
  exp: number;
};

const encryptionKey = (namespace = 'cineseya') => createHash('sha256').update(`${namespace}-download-encryption:${env.DOWNLOAD_SIGNING_SECRET}`).digest();
const sign = (body: string) => createHmac('sha256', env.DOWNLOAD_SIGNING_SECRET).update(body).digest('base64url');

function decryptPayload(sealed: Buffer, namespace?: string) {
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(namespace), sealed.subarray(0, 12));
  decipher.setAuthTag(sealed.subarray(12, 28));
  return JSON.parse(Buffer.concat([decipher.update(sealed.subarray(28)), decipher.final()]).toString('utf8')) as Partial<DownloadTokenPayload>;
}

export function createDownloadToken(payload: DownloadTokenPayload) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
  const body = Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
  return `${body}.${sign(body)}`;
}

export function verifyDownloadToken(token: string): DownloadTokenPayload {
  const [body, suppliedSignature, ...extra] = token.split('.');
  if (!body || !suppliedSignature || extra.length) throw invalidToken();
  const expectedSignature = sign(body);
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) throw invalidToken();
  try {
    const sealed = Buffer.from(body, 'base64url');
    if (sealed.length < 29) throw invalidToken();
    let payload: Partial<DownloadTokenPayload>;
    try {
      payload = decryptPayload(sealed);
    } catch {
      payload = decryptPayload(sealed, 'cinerusubs');
    }
    const exp = payload.exp;
    if (!payload.mediaVersionId || !payload.objectKey || !payload.bucket || !payload.fileName || !payload.contentType || typeof exp !== 'number' || !Number.isInteger(exp)) throw invalidToken();
    if (exp * 1_000 <= Date.now()) throw Object.assign(new Error('This download link has expired. Generate a new link.'), { status: 410, code: 'DOWNLOAD_TOKEN_EXPIRED' });
    return payload as DownloadTokenPayload;
  } catch (error) {
    if ((error as { code?: string }).code === 'DOWNLOAD_TOKEN_EXPIRED') throw error;
    throw invalidToken();
  }
}

function invalidToken() {
  return Object.assign(new Error('The download link is invalid or has been modified.'), { status: 403, code: 'INVALID_DOWNLOAD_TOKEN' });
}
