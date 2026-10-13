'use client';

import { Bookmark, Check } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { readCsrfToken, readMigratedStorage, WATCHLIST_CHANGE_EVENT, WATCHLIST_STORAGE_KEY } from '@/lib/client/browser-brand';

const KEY = WATCHLIST_STORAGE_KEY;
type LocalItem = { id: string; type: 'movie' | 'series'; slug: string; title: string; posterUrl: string; addedAt: string };

export function WatchlistButton({ id, type = 'movie', slug, title, posterUrl, label = false }: { id: string; type?: 'movie' | 'series'; slug: string; title: string; posterUrl: string; label?: boolean }) {
  const saved = useSyncExternalStore((onChange) => {
    addEventListener(WATCHLIST_CHANGE_EVENT, onChange);
    addEventListener('storage', onChange);
    return () => { removeEventListener(WATCHLIST_CHANGE_EVENT, onChange); removeEventListener('storage', onChange); };
  }, () => {
    const items: LocalItem[] = JSON.parse(readMigratedStorage(KEY) || '[]');
    return items.some((item) => item.id === id && item.type === type);
  }, () => false);
  const toggle = () => {
    const items: LocalItem[] = JSON.parse(readMigratedStorage(KEY) || '[]');
    const exists = items.some((item) => item.id === id && item.type === type);
    const next = exists ? items.filter((item) => !(item.id === id && item.type === type)) : [...items, { id, type, slug, title, posterUrl, addedAt: new Date().toISOString() }];
    localStorage.setItem(KEY, JSON.stringify(next));
    dispatchEvent(new CustomEvent(WATCHLIST_CHANGE_EVENT));
    if (document.documentElement.dataset.authenticated === 'true') {
      const csrf = readCsrfToken();
      void fetch('/api/watchlist', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf }, body: JSON.stringify({ contentType: type, contentId: id, action: exists ? 'remove' : 'add' }) });
    }
  };
  return <button className={`watchlist-button ${saved ? 'saved' : ''} ${label ? 'with-label' : ''}`} aria-label={saved ? `Remove ${title} from watchlist` : `Add ${title} to watchlist`} aria-pressed={saved} onClick={(event) => { event.preventDefault(); toggle(); }}>{saved ? <Check /> : <Bookmark />}{label && <span>{saved ? 'In Watchlist' : 'Watchlist'}</span>}</button>;
}
