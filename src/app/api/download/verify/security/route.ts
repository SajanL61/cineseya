import { z } from 'zod';
import { apiError } from '@/lib/http';
import { enforceRateLimit } from '@/lib/rate-limit';
import { verifyDownloadSecurity } from '@/services/download-verification';

const inputSchema = z.object({ sessionToken: z.string().trim().min(20).max(200), turnstileToken: z.string().trim().max(4_000).optional() });

export async function POST(request: Request) {
  try {
    await enforceRateLimit(request, 'download-verify-security', 10, 10 * 60_000);
    const input = inputSchema.parse(await request.json());
    const result = await verifyDownloadSecurity(request, input.sessionToken, input.turnstileToken);
    return Response.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return apiError(error); }
}
