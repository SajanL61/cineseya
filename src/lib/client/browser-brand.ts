'use client';

export const WATCHLIST_STORAGE_KEY = 'cineseya-watchlist-v1';
export const WATCHLIST_CHANGE_EVENT = 'cineseya-watchlist-change';
export const RECENT_SEARCH_STORAGE_KEY = 'cineseya-recent-searches-v1';

const LEGACY_WATCHLIST_STORAGE_KEY = 'cinerusubs-watchlist-v1';
const LEGACY_RECENT_SEARCH_STORAGE_KEY = 'cinerusubs-recent-searches-v1';
const CSRF_COOKIE_NAMES = ['cineseya_csrf', 'cinerusubs_csrf'] as const;

export function readCsrfToken() {
  for (const name of CSRF_COOKIE_NAMES) {
    const value = document.cookie.split('; ').find((entry) => entry.startsWith(`${name}=`))?.split('=').slice(1).join('=');
    if (value) return decodeURIComponent(value);
  }
  return '';
}

export function readMigratedStorage(key: typeof WATCHLIST_STORAGE_KEY | typeof RECENT_SEARCH_STORAGE_KEY) {
  const current = localStorage.getItem(key);
  if (current !== null) return current;
  const legacyKey = key === WATCHLIST_STORAGE_KEY ? LEGACY_WATCHLIST_STORAGE_KEY : LEGACY_RECENT_SEARCH_STORAGE_KEY;
  const legacy = localStorage.getItem(legacyKey);
  if (legacy !== null) {
    localStorage.setItem(key, legacy);
    localStorage.removeItem(legacyKey);
  }
  return legacy;
}
