'use client';

import { Bell, Bookmark, Menu, Search, UserRound, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Logo } from '@/components/ui/logo';
import { SearchOverlay } from './search-overlay';
import type { AuthUser } from '@/types/auth';

const links = [
  ['/movies', 'Movies'], ['/tv', 'TV Series'], ['/subtitles/sinhala', 'Sinhala Subtitles'], ['/movies?sort=newest', 'New Releases'],
  ['/discover?sort=trending', 'Trending'], ['/genres', 'Genres'], ['/languages', 'Languages'],
] as const;

export function SiteHeader({ user }: { user: AuthUser | null }) {
  const pathname = usePathname();
  const [compact, setCompact] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > 28);
    onScroll();
    addEventListener('scroll', onScroll, { passive: true });
    return () => removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === 'Escape') setMenuOpen(false);
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [menuOpen]);

  return <>
    <header className={`site-header ${compact ? 'is-compact' : ''}`}>
      <div className="header-inner">
        <button className="header-icon mobile-menu-button" aria-label="Open navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}><Menu /></button>
        <Logo />
        <nav className="desktop-navigation" aria-label="Primary navigation">
          {links.map(([href, label]) => <Link key={href} className={pathname === href.split('?')[0] ? 'active' : ''} href={href}>{label}</Link>)}
        </nav>
        <div className="header-actions">
          <button className="search-trigger" onClick={() => setSearchOpen(true)} aria-label="Search CineSeya.lk">
            <Search /><span>Search movies, series, subtitles</span><kbd>⌘ K</kbd>
          </button>
          <Link className="header-icon" href="/watchlist" aria-label="Watchlist"><Bookmark /></Link>
          <Link className="header-icon desktop-notification" href="/profile/notifications" aria-label="Notifications"><Bell /></Link>
          <Link className="profile-trigger" href={user ? '/profile' : '/login'} aria-label={user ? `Open ${user.displayName}'s profile` : 'Sign in or open profile'}><UserRound /><span>{user ? user.displayName.split(' ')[0] : 'Sign in'}</span></Link>
        </div>
      </div>
    </header>
    {menuOpen && <div className="mobile-drawer-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setMenuOpen(false)}>
      <aside className="mobile-drawer" role="dialog" aria-modal="true" aria-label="Navigation">
        <div className="drawer-head"><Logo /><button className="header-icon" aria-label="Close navigation" onClick={() => setMenuOpen(false)}><X /></button></div>
        <button className="drawer-search" onClick={() => { setMenuOpen(false); setSearchOpen(true); }}><Search />Search CineSeya.lk</button>
        <nav>{links.map(([href, label]) => <Link key={href} href={href} onClick={() => setMenuOpen(false)}>{label}<span>›</span></Link>)}</nav>
        <div className="drawer-account"><Link href="/watchlist">My watchlist</Link><Link href="/login">Sign in</Link></div>
      </aside>
    </div>}
    <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
  </>;
}
