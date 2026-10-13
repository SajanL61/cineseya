import { Activity, CheckCircle2, CircleAlert, Clock3, Cpu } from 'lucide-react';
import { TranscodingDashboard } from '@/components/admin/transcoding-dashboard';
import { requirePagePermission } from '@/lib/auth';
import { getAdminTranscodeDashboard } from '@/services/transcoding';

export const metadata = { title: 'Transcoding' };
export const dynamic = 'force-dynamic';

export default async function TranscodingPage() {
  await requirePagePermission('media.read', '/admin/transcoding');
  const data = await getAdminTranscodeDashboard();
  const lastHeartbeat = data.worker?.lastHeartbeatAt ? new Date(String(data.worker.lastHeartbeatAt)) : null;
  const workerOnline = data.workerOnline;
  const cards = [[data.counts.queued,'Queued',Clock3],[data.counts.processing,'Processing',Activity],[data.counts.completedToday,'Completed today',CheckCircle2],[data.counts.failed,'Failed',CircleAlert],[workerOnline?'Online':'Offline','Worker status',Cpu]] as const;
  return <><header className="admin-page-head"><div><span>Media operations</span><h1>Transcoding</h1><p>FFmpeg jobs run only on the dedicated worker. Progress is throttled and stored without raw command logs.</p></div></header><section className="admin-stats transcode-stats">{cards.map(([value,label,Icon])=><div key={label}><Icon/><span>{label}</span><b>{value}</b>{label==='Worker status'&&lastHeartbeat?<small>Last heartbeat {lastHeartbeat.toLocaleString('en-LK')}</small>:null}</div>)}</section><TranscodingDashboard jobs={data.jobs as unknown as Parameters<typeof TranscodingDashboard>[0]['jobs']}/></>;
}
