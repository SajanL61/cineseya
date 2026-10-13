import 'server-only';
import { connectDb } from '@/lib/db';
import { useDemoData } from '@/lib/env';
import { requestClientKey } from '@/lib/rate-limit';
import { AnalyticsEvent } from '@/models';

export type AnalyticsEventType = 'direct_download_started' | 'mirror_click' | 'dotflix_click' | 'telegram_mirror_click' | 'subtitle_download' | 'whatsapp_share' | 'facebook_share' | 'telegram_share' | 'copy_link' | 'watch_started' | 'watch_25_percent' | 'watch_50_percent' | 'watch_75_percent' | 'watch_completed' | 'quality_selected' | 'data_saver_enabled' | 'buffer_event';

function deviceCategory(userAgent: string) {
  if (/ipad|tablet/i.test(userAgent)) return 'tablet';
  if (/mobile|android|iphone/i.test(userAgent)) return 'mobile';
  return userAgent ? 'desktop' : 'unknown';
}

export async function recordAnalyticsEvent(request: Request, input: { eventType: AnalyticsEventType; contentType?: string; contentId?: string; mediaVersion?: unknown; mirror?: unknown; providerType?: string; quality?: string; durationSeconds?: number; path?: string }) {
  if (useDemoData) return;
  await connectDb();
  const userAgent = request.headers.get('user-agent') || '';
  await AnalyticsEvent.create({ ...input, ipHash: requestClientKey(request), deviceCategory: deviceCategory(userAgent) });
}
