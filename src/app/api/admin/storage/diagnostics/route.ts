import { randomUUID } from 'node:crypto';
import { assertMutationRequest, requirePermission } from '@/lib/auth';
import { connectDb } from '@/lib/db';
import { apiError } from '@/lib/http';
import { enforceRateLimit } from '@/lib/rate-limit';
import { deleteObject, inspectObject, readObjectBytes, writeObjectBytes, type R2BucketKind } from '@/lib/r2';
import { AuditLog } from '@/models';

type DiagnosticResult = {
  bucket: R2BucketKind;
  label: string;
  connected: boolean;
  write: boolean;
  read: boolean;
  delete: boolean;
  error?: string;
};

async function diagnoseBucket(bucket: R2BucketKind, label: string): Promise<DiagnosticResult> {
  const result: DiagnosticResult = { bucket, label, connected: false, write: false, read: false, delete: false };
  const key = `diagnostics/${randomUUID()}.txt`;
  const payload = new TextEncoder().encode(`cineseya-r2-diagnostic:${randomUUID()}`);
  let created = false;
  let stage = 'write';
  try {
    await writeObjectBytes(key, payload, 'text/plain', bucket);
    created = true;
    result.write = true;
    stage = 'HEAD';
    const head = await inspectObject(key, bucket);
    if (Number(head.ContentLength) !== payload.byteLength) throw new Error('HEAD size mismatch');
    result.connected = true;
    stage = 'read';
    const stored = await readObjectBytes(key, bucket);
    if (stored.byteLength !== payload.byteLength || stored.some((value, index) => value !== payload[index])) throw new Error('Read content mismatch');
    result.read = true;
  } catch {
    result.error = `${stage} check failed.`;
  } finally {
    if (created) {
      try {
        await deleteObject(key, bucket);
        result.delete = true;
      } catch {
        result.error = result.error || 'Delete check failed.';
      }
    }
  }
  return result;
}

export async function POST(request: Request) {
  try {
    const session = await requirePermission('media.upload');
    await assertMutationRequest(request, session);
    await enforceRateLimit(request, 'admin-r2-diagnostics', 5, 10 * 60_000);
    await connectDb();
    const results = await Promise.all([
      diagnoseBucket('assets', 'Assets Bucket'),
      diagnoseBucket('media', 'Media Bucket'),
    ]);
    await AuditLog.create({ actor: session.user.id, action: 'storage.r2_diagnostics', entity: 'Storage', metadata: { results: results.map(({ bucket, connected, write, read, delete: deleted }) => ({ bucket, connected, write, read, delete: deleted })) } });
    return Response.json({ results }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return apiError(error);
  }
}
