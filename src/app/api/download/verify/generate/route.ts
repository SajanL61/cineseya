import { z } from 'zod';
import { apiError } from '@/lib/http';
import { enforceRateLimit } from '@/lib/rate-limit';
import { generateReadyDownload } from '@/services/download-verification';

const inputSchema = z.object({ sessionToken: z.string().trim().min(20).max(200) });

export async function POST(request: Request) {
  try {
    await enforceRateLimit(request, 'download-verify-generate', 8, 10 * 60_000);
    const input = inputSchema.parse(await request.json());
    const result = await generateReadyDownload(request, input.sessionToken);
    return Response.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return apiError(error); }
}
