import 'server-only';
import { connectDb } from '@/lib/db';
import { useDemoData } from '@/lib/env';
import { normalizeSearchText } from '@/lib/search';
import { SearchEvent } from '@/models';

export async function recordSearchEvent(query: string, resultCount: number, locale?: string) {
  if (useDemoData) return;
  const normalizedQuery = normalizeSearchText(query).slice(0, 120);
  if (normalizedQuery.length < 2) return;
  await connectDb();
  await SearchEvent.create({ query: query.trim().slice(0, 120), normalizedQuery, resultCount, locale: locale?.slice(0, 12) });
}

export async function getTrendingSearches(limit = 8) {
  if (useDemoData) return [];
  await connectDb();
  const since = new Date(Date.now() - 14 * 86_400_000);
  const rows = await SearchEvent.aggregate<{ _id: string; label: string; count: number }>([
    { $match: { createdAt: { $gte: since } } },
    { $group: { _id: '$normalizedQuery', label: { $last: '$query' }, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: Math.max(1, Math.min(20, limit)) },
  ]);
  return rows.map((item) => ({ query: item.label || item._id, count: item.count }));
}
