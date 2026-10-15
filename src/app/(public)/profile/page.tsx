import { Bell, Bookmark, Clock3, ShieldCheck, Star, UserRound } from 'lucide-react';
import Link from 'next/link';
import { ChangePasswordForm } from '@/components/auth/change-password-form';
import { requireUser } from '@/lib/auth';
import { LogoutButton } from '@/components/auth/logout-button';

export const metadata = { title: 'Your profile', robots: { index: false, follow: false } };
export default async function ProfilePage() {
  const { user } = await requireUser('/profile');
  return <section className="profile-page"><header><div className="profile-avatar"><UserRound/></div><div><span>Member profile</span><h1>{user.displayName}</h1><p>{user.email}</p></div><div className="profile-role"><ShieldCheck/><span>{user.role.replace('_',' ')}</span></div></header><div className="profile-grid">
    <Link href="/watchlist"><Bookmark/><b>Watchlist</b><span>Titles saved for later</span></Link>
    <Link href="/profile/notifications"><Bell/><b>Notifications</b><span>Release and subtitle updates</span></Link>
    <div><Clock3/><b>Viewing progress</b><span>Appears after you watch licensed media</span></div>
    <div><Star/><b>Ratings</b><span>Your movie and subtitle ratings</span></div>
  </div><section className="profile-settings"><h2>Account</h2><dl><div><dt>Display name</dt><dd>{user.displayName}</dd></div><div><dt>Language</dt><dd>{user.locale === 'si' ? 'Sinhala' : 'English'}</dd></div><div><dt>Access role</dt><dd>{user.role.replace('_',' ')}</dd></div></dl>{user.permissions.includes('admin.access') && <Link className="action-button" href="/admin">Open administration</Link>}<LogoutButton/><ChangePasswordForm/></section></section>;
}
