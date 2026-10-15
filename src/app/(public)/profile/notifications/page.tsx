import { Bell } from 'lucide-react';
import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { connectDb } from '@/lib/db';
import { Notification } from '@/models';

export const metadata = { title: 'Notifications', robots: { index: false, follow: false } };
export default async function NotificationsPage() {
  const { user } = await requireUser('/profile/notifications');
  await connectDb();
  const notifications = await Notification.find({ user: user.id }).sort({ createdAt: -1 }).limit(50).lean();
  return <section className="simple-page"><header><span>Your account</span><h1>Notifications</h1><p>Subtitle updates, replies and platform notices for {user.displayName}.</p></header>{notifications.length ? <div className="notification-list">{notifications.map((item) => { const payload = item.payload as { message?: string; href?: string } | undefined; return <article key={String(item._id)}><Bell/><div><b>{String(item.type).replaceAll('_',' ')}</b><p>{String(payload?.message || 'A new account update is available.')}</p><time>{new Date(item.createdAt as Date).toLocaleDateString('en-LK')}</time>{payload?.href?.startsWith('/') && !payload.href.startsWith('//') ? <Link href={payload.href}>View update</Link> : null}</div></article>; })}</div> : <div className="watchlist-empty"><Bell/><h2>You are all caught up</h2><p>New subtitle releases and account updates will appear here.</p></div>}</section>;
}
