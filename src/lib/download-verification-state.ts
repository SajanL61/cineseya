export type VerificationProgress = { step1CompletedAt?: unknown; step2CompletedAt?: unknown; step3CompletedAt?: unknown; expiresAt: Date | string | number };

export function verificationExpired(expiresAt: Date | string | number, now = Date.now()) {
  const value = new Date(expiresAt).getTime();
  return !Number.isFinite(value) || value <= now;
}

export function assertVerificationOrder(progress: VerificationProgress, next: 'security' | 'generate' | 'download') {
  if (verificationExpired(progress.expiresAt)) throw Object.assign(new Error('The verification session expired. Start again.'), { status: 410, code: 'VERIFICATION_EXPIRED' });
  if (!progress.step1CompletedAt || ((next === 'generate' || next === 'download') && !progress.step2CompletedAt) || (next === 'download' && !progress.step3CompletedAt)) {
    throw Object.assign(new Error('Complete the verification steps in order.'), { status: 409, code: 'VERIFICATION_ORDER' });
  }
}
