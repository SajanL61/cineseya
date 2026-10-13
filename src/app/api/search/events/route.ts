import { z } from 'zod';
import { apiError } from '@/lib/http';
import { enforceRateLimit } from '@/lib/rate-limit';
import { assertSameOrigin } from '@/lib/request-security';
import { recordSearchEvent } from '@/services/search-analytics';

const schema = z.object({ query: z.string().trim().min(2).max(120), resultCount: z.number().int().min(0).max(10_000), locale: z.string().trim().max(12).optional() });

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await enforceRateLimit(request, 'search-event', 30, 10 * 60_000);
    const input = schema.parse(await request.json());
    await recordSearchEvent(input.query, input.resultCount, input.locale);
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return apiError(error); }
}
