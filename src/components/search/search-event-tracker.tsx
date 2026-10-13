'use client';

import { useEffect } from 'react';

export function SearchEventTracker({ query, resultCount }: { query: string; resultCount: number }) {
  useEffect(() => {
    if (query.trim().length < 2) return;
    void fetch('/api/search/events', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, resultCount, locale: document.documentElement.lang }) }).catch(() => undefined);
  }, [query, resultCount]);
  return null;
}
