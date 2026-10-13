import { z } from 'zod';
import { apiError } from '@/lib/http';
import { enforceRateLimit } from '@/lib/rate-limit';
import { verifyDownloadFile } from '@/services/download-verification';

const inputSchema = z.object({ mediaVersionId: z.string().trim().min(1).max(80), mirrorId: z.string().trim().min(1).max(80).optional() });

export async function POST(request: Request) {
  try {
    await enforceRateLimit(request, 'download-verify-file', 10, 10 * 60_000);
    const input = inputSchema.parse(await request.json());
    const result = await verifyDownloadFile(request, input.mediaVersionId, input.mirrorId);
    return Response.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return apiError(error); }
}
