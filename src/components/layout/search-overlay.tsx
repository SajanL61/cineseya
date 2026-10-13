'use client';

import { ArrowRight, Clock3, Search, TrendingUp, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { SafeImage } from '@/components/ui/safe-image';
import { readMigratedStorage, RECENT_SEARCH_STORAGE_KEY } from '@/lib/client/browser-brand';
import { splitMatchedText } from '@/lib/search';

type Suggestion = { type: string; title: string; subtitle: string; slug: string; href?: string; image?: string };
const RECENT_KEY = RECENT_SEARCH_STORAGE_KEY;

function destination(item: Suggestion) {
  if (item.href) return item.href;
  if (item.type === 'movie') return `/movies/${item.slug}`;
  if (item.type === 'series') return `/tv/${item.slug}`;
  if (item.type === 'person') return `/person/${item.slug}`;
  if (item.type === 'translator') return `/translator/${item.slug}`;
  return `/movies/${item.slug}#subtitles`;
}

function Highlight({ value, query }: { value: string; query: string }) {
  const parts = splitMatchedText(value, query);
  return <>{parts.before}{parts.match ? <mark>{parts.match}</mark> : null}{parts.after}</>;
}

export function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<Suggestion[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [trending, setTrending] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const recentFrame = requestAnimationFrame(() => { setRecent(JSON.parse(readMigratedStorage(RECENT_KEY) || '[]')); setActiveIndex(-1); });
    const trendingController = new AbortController();
    void fetch('/api/search/trending', { signal: trendingController.signal }).then((response) => response.ok ? response.json() : null).then((result) => { if (result?.items) setTrending(result.items.map((item: { query: string }) => item.query)); }).catch(() => undefined);
    const prior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => inputRef.current?.focus());
    const key = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    addEventListener('keydown', key);
    return () => { trendingController.abort(); cancelAnimationFrame(recentFrame); document.body.style.overflow = prior; removeEventListener('keydown', key); };
  }, [open, onClose]);

  useEffect(() => {
    if (query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/search/suggest?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        if (response.ok) { setItems((await response.json()).items); setActiveIndex(-1); }
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }, 280);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);

  if (!open) return null;
  const remember = (value: string) => {
    const next = [value, ...recent.filter((entry) => entry !== value)].slice(0, 6);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  };
  const choose = (item: Suggestion) => { remember(query.trim()); onClose(); router.push(destination(item)); };
  const handleInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (!items.length) return;
    if (event.key === 'ArrowDown') { event.preventDefault(); setActiveIndex((value) => value >= items.length - 1 ? 0 : value + 1); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setActiveIndex((value) => value <= 0 ? items.length - 1 : value - 1); }
    else if (event.key === 'Enter' && activeIndex >= 0) { event.preventDefault(); choose(items[activeIndex]!); }
  };

  return <div className="search-overlay" role="dialog" aria-modal="true" aria-label="Search CineSeya.lk">
    <div className="search-dialog">
      <div className="search-dialog-head"><div className="search-field"><Search /><input ref={inputRef} role="combobox" aria-expanded={items.length > 0} aria-controls="search-suggestions" aria-activedescendant={activeIndex >= 0 ? `search-suggestion-${activeIndex}` : undefined} value={query} onChange={(event) => { setQuery(event.target.value); setActiveIndex(-1); }} onKeyDown={handleInputKeyDown} placeholder="Search titles, actors, genres or translators…" aria-label="Search" /><kbd>ESC</kbd></div><button aria-label="Close search" onClick={onClose}><X /></button></div>
      <div className="search-dialog-body">
        {query.trim().length >= 2 ? <>
          <div className="search-state"><span>Results for “{query}”</span>{loading && <i>Searching…</i>}</div>
          <div className="suggestion-list" id="search-suggestions" role="listbox">
            {!loading && items.map((item, index) => <Link id={`search-suggestion-${index}`} role="option" aria-selected={activeIndex === index} className={activeIndex === index ? 'active' : ''} key={`${item.type}-${item.slug}`} href={destination(item)} onMouseEnter={() => setActiveIndex(index)} onClick={() => { remember(query.trim()); onClose(); }}>
              <span className="suggestion-image">{item.image ? <SafeImage src={item.image} fallbackSrc="/media/fallback-poster.svg" alt="" fill sizes="52px" /> : <Search />}</span>
              <span><b><Highlight value={item.title} query={query}/></b><small>{item.subtitle}</small></span><em>{item.type}</em><ArrowRight />
            </Link>)}
            {!loading && !items.length && <div className="no-suggestions"><Search /><b>No close matches</b><p>Try fewer words, an original title, actor, language, or translator name.</p><Link href={`/search?q=${encodeURIComponent(query)}`} onClick={() => { remember(query.trim()); onClose(); }}>Search all content</Link></div>}
          </div>
          {items.length > 0 && <Link className="all-results-link" href={`/search?q=${encodeURIComponent(query)}`} onClick={() => { remember(query.trim()); onClose(); }}>View all search results <ArrowRight /></Link>}
        </> : <div className="search-start">
          {recent.length > 0 && <section><div className="search-section-title"><span><Clock3 />Recent searches</span><button onClick={() => { localStorage.removeItem(RECENT_KEY); setRecent([]); }}>Clear</button></div><div className="search-pills">{recent.map((entry) => <button key={entry} onClick={() => { setQuery(entry); setActiveIndex(-1); }}>{entry}</button>)}</div></section>}
          {trending.length > 0 && <section><div className="search-section-title"><span><TrendingUp />Trending searches</span></div><div className="trending-searches">{trending.map((entry, index) => <button key={entry} onClick={() => { setQuery(entry); setActiveIndex(-1); }}><b>{String(index + 1).padStart(2, '0')}</b><span>{entry}</span><ArrowRight /></button>)}</div></section>}
          <p className="search-tip"><kbd>↑</kbd><kbd>↓</kbd> navigate <kbd>Enter</kbd> select <kbd>Esc</kbd> close</p>
        </div>}
      </div>
    </div>
  </div>;
}
