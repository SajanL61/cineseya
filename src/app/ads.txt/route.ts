import { googleAdsTxtLine } from '@/lib/ads';
import { getAdSettings } from '@/services/ad-settings';

export async function GET() {
  const settings = await getAdSettings();
  const entries = [...settings.adsTxt.additionalEntries];
  const google = settings.adsTxt.includeGoogleSeller ? googleAdsTxtLine(settings.publisherId) : undefined;
  if (google && !entries.includes(google)) entries.unshift(google);
  return new Response(entries.length ? `${entries.join('\n')}\n` : '', {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=300, s-maxage=300' },
  });
}
