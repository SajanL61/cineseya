'use client';

import { Activity, BarChart3, Captions, ChevronLeft, CircleUserRound, Clapperboard, Cpu, Database, Film, FolderKanban, Gauge, Gavel, Home, KeyRound, Languages, Menu, MessageSquare, Settings, ShieldCheck, Tags, UsersRound, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { LogoutButton } from '@/components/auth/logout-button';
import { Logo } from '@/components/ui/logo';
import type { AuthUser } from '@/types/auth';

const navigation = [
  ['Overview','/admin',Gauge], ['Movies','/admin/movies',Film], ['TV series','/admin/series',Clapperboard], ['Subtitles','/admin/subtitles',Captions], ['Subtitle requests','/admin/subtitle-requests',Captions],
  ['Translators','/admin/translators',Languages], ['Homepage','/admin/homepage',Home], ['Taxonomies','/admin/taxonomies',Tags], ['Media storage','/admin/media',Database], ['Transcoding','/admin/transcoding',Cpu],
  ['Users','/admin/users',UsersRound], ['Comments','/admin/comments',MessageSquare], ['Reports','/admin/reports',ShieldCheck], ['Takedowns','/admin/takedowns',Gavel],
  ['Analytics','/admin/analytics',BarChart3], ['Messages','/admin/messages',FolderKanban], ['Audit log','/admin/audit',Activity], ['Settings','/admin/settings',Settings],
] as const;

export function AdminShell({ user, children }: { user: AuthUser; children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return <div className="admin-shell"><aside className={`admin-sidebar ${open ? 'open' : ''}`}><div className="admin-brand"><Logo/><button aria-label="Close administration navigation" onClick={() => setOpen(false)}><X/></button></div><nav>{navigation.map(([label,href,Icon]) => <Link className={pathname === href || (href !== '/admin' && pathname.startsWith(href)) ? 'active' : ''} href={href} key={href} onClick={() => setOpen(false)}><Icon/><span>{label}</span></Link>)}</nav><div className="admin-account"><CircleUserRound/><div><b>{user.displayName}</b><span>{user.role.replace('_',' ')}</span></div><Link className="admin-security-link" href="/profile#password-security"><KeyRound/>Change password</Link><LogoutButton/></div></aside>{open && <button className="admin-backdrop" aria-label="Close navigation" onClick={() => setOpen(false)}/>}<div className="admin-workspace"><header className="admin-topbar"><button className="admin-menu" aria-label="Open administration navigation" onClick={() => setOpen(true)}><Menu/></button><Link href="/" className="admin-back"><ChevronLeft/> View public site</Link><div><span>Secure administration</span><b>CineSeya.lk control room</b></div></header><main className="admin-main">{children}</main></div></div>;
}
