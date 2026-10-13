import { Captions, Clock3, UsersRound } from 'lucide-react';
import Link from 'next/link';
import { requirePagePermission } from '@/lib/auth';
import { getAdminSubtitleRequests } from '@/services/subtitle-interest';

export const metadata = { title: 'Subtitle Requests' };
export const dynamic = 'force-dynamic';

export default async function SubtitleRequestsPage({ searchParams }: { searchParams: Promise<{ sort?: string }> }) {
  await requirePagePermission('subtitles.read', '/admin/subtitle-requests');
  const { sort: rawSort } = await searchParams;
  const sort = rawSort === 'newest' || rawSort === 'upcoming' ? rawSort : 'requested';
  const requests = await getAdminSubtitleRequests(sort);
  return <><header className="admin-page-head"><div><span>Subtitle demand</span><h1>Subtitle Requests</h1><p>Prioritize genuine Sinhala subtitle demand without turning requests into release promises.</p></div></header>
    <nav className="admin-sort-tabs" aria-label="Sort subtitle requests"><Link className={sort === 'requested' ? 'active' : ''} href="/admin/subtitle-requests?sort=requested">Most Requested</Link><Link className={sort === 'newest' ? 'active' : ''} href="/admin/subtitle-requests?sort=newest">Newest</Link><Link className={sort === 'upcoming' ? 'active' : ''} href="/admin/subtitle-requests?sort=upcoming">Upcoming</Link></nav>
    <section className="admin-panel"><div className="admin-request-list">{requests.length ? requests.map((item) => <article key={`${item.contentType}-${item.contentId}`}><span><Captions/></span><div><b>{item.title}</b><small>{item.contentType} · newest request {new Date(item.newestAt).toLocaleDateString('en-LK')}{item.releaseDate ? ` · release ${new Date(item.releaseDate).toLocaleDateString('en-LK')}` : ''}</small></div><strong><UsersRound/>{item.requestCount.toLocaleString()}</strong><Link href={item.href || '/'} target="_blank">Open</Link></article>) : <div className="inline-empty"><Clock3/> No open Sinhala subtitle requests.</div>}</div></section>
  </>;
}
