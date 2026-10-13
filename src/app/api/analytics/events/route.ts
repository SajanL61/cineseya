import { z } from 'zod';
import { apiError } from '@/lib/http';
import { enforceRateLimit } from '@/lib/rate-limit';
import { assertSameOrigin } from '@/lib/request-security';
import { recordAnalyticsEvent } from '@/services/analytics';

const inputSchema = z.object({
  eventType: z.enum(['whatsapp_share', 'facebook_share', 'telegram_share', 'copy_link', 'watch_started', 'watch_25_percent', 'watch_50_percent', 'watch_75_percent', 'watch_completed', 'quality_selected', 'data_saver_enabled', 'buffer_event']),
  contentType: z.enum(['movie', 'series', 'episode', 'subtitle', 'page']).optional(),
  contentId: z.string().trim().max(120).optional(),
  quality: z.string().trim().max(80).optional(),
  durationSeconds: z.number().min(0).max(86_400).optional(),
  path: z.string().trim().max(500).refine((value) => value.startsWith('/') && !value.startsWith('//'), 'Invalid share path.'),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await enforceRateLimit(request, 'analytics-event', 80, 10 * 60_000);
    const input = inputSchema.parse(await request.json());
    await recordAnalyticsEvent(request, input);
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return apiError(error); }
}
