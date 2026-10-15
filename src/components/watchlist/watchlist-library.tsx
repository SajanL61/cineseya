'use client';

import { BookmarkX } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useSyncExternalStore } from 'react';
import { CinePoster } from '@/components/ui/cine-artwork';
import type { FocalPoint } from '@/lib/artwork';
import { readCsrfToken, readMigratedStorage, WATCHLIST_CHANGE_EVENT, WATCHLIST_STORAGE_KEY } from '@/lib/client/browser-brand';

const KEY = WATCHLIST_STORAGE_KEY;
type Item = { id: string; type: 'movie' | 'series'; slug: string; title: string; posterUrl: string; posterFocalPoint?: FocalPoint; addedAt: string };

export function WatchlistLibrary() {
  const raw = useSyncExternalStore((onChange) => {
    addEventListener(WATCHLIST_CHANGE_EVENT, onChange);
    addEventListener('storage', onChange);
    return () => { removeEventListener(WATCHLIST_CHANGE_EVENT, onChange); removeEventListener('storage', onChange); };
  }, () => readMigratedStorage(KEY) || '[]', () => '[]');
  const items: Item[] = useMemo(() => JSON.parse(raw), [raw]);
  if (!items.length) return <div className="watchlist-empty"><BookmarkX/><h2>Your watchlist is ready</h2><p>Save a movie or series from any card or title page and it will appear here. Sign in later to sync it across devices.</p><Link className="action-button" href="/discover">Discover titles</Link></div>;
  const remove = (id: string, type: string) => { const next = items.filter((item) => !(item.id === id && item.type === type)); localStorage.setItem(KEY, JSON.stringify(next)); dispatchEvent(new CustomEvent(WATCHLIST_CHANGE_EVENT)); if(document.documentElement.dataset.authenticated==='true'){const csrf=readCsrfToken();void fetch('/api/watchlist',{method:'POST',headers:{'Content-Type':'application/json','x-csrf-token':csrf},body:JSON.stringify({contentType:type,contentId:id,action:'remove'})});} };
  return <div className="watchlist-grid">{items.map((item) => <article key={`${item.type}-${item.id}`}><Link href={item.type === 'movie' ? `/movies/${item.slug}` : `/tv/${item.slug}`}><span><CinePoster src={item.posterUrl} alt={`${item.title} poster`} focalPoint={item.posterFocalPoint} fillContainer sizes="180px"/></span><h3>{item.title}</h3><p>{item.type === 'movie' ? 'Movie' : 'TV Series'}</p></Link><button onClick={() => remove(item.id,item.type)}>Remove</button></article>)}</div>;
}
