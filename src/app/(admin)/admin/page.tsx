import { Captions, Download, Film, Gavel, ShieldAlert, Tv, UsersRound } from 'lucide-react';
import Link from 'next/link';
import { requirePagePermission } from '@/lib/auth';
import { getAdminOverview } from '@/services/admin';

export const metadata = { title: 'Overview' };
export default async function AdminOverviewPage() {
  const { user } = await requirePagePermission('admin.access','/admin');
  const data = await getAdminOverview();
  const stats = [[data.movies,'Movies',Film,'/admin/movies'],[data.series,'TV series',Tv,'/admin/series'],[data.subtitles,'Subtitles',Captions,'/admin/subtitles'],[data.users,'Users',UsersRound,'/admin/users'],[data.downloads,'Recorded downloads',Download,'/admin/analytics']] as const;
  return <><header className="admin-page-head"><div><span>Platform overview</span><h1>Good to see you, {user.displayName.split(' ')[0]}</h1><p>Live operational totals from the isolated CineSeya.lk database.</p></div><Link className="admin-primary" href="/admin/movies/new">Add a movie</Link></header><section className="admin-stats">{stats.map(([value,label,Icon,href])=><Link href={href} key={label}><Icon/><span>{label}</span><b>{value.toLocaleString()}</b></Link>)}</section><div className="admin-dashboard-grid"><section className="admin-panel"><div className="admin-panel-head"><h2>Needs attention</h2></div><div className="admin-attention"><Link href="/admin/subtitle-requests"><Captions/><span><b>{data.openSubtitleRequests}</b> subtitle requests</span></Link><Link href="/admin/reports"><ShieldAlert/><span><b>{data.openReports}</b> open reports</span></Link><Link href="/admin/takedowns"><Gavel/><span><b>{data.openTakedowns}</b> takedown requests</span></Link></div></section><section className="admin-panel"><div className="admin-panel-head"><h2>Recent audit activity</h2><Link href="/admin/audit">View log</Link></div><div className="audit-mini">{data.recentAudit.length ? data.recentAudit.map((entry)=><div key={String(entry._id)}><span>{String(entry.action)}</span><small>{String(entry.entity)} · {new Date(String(entry.createdAt)).toLocaleString('en-LK')}</small></div>) : <p>No administrative changes have been recorded yet.</p>}</div></section></div></>;
}
