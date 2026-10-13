import { apiError } from '@/lib/http';
import { enforceRateLimit } from '@/lib/rate-limit';
import { getTrendingSearches } from '@/services/search-analytics';

export async function GET(request: Request) {
  try {
    await enforceRateLimit(request, 'trending-searches', 90, 60_000);
    const items = await getTrendingSearches();
    return Response.json({ items }, { headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=600' } });
  } catch (error) { return apiError(error); }
}
