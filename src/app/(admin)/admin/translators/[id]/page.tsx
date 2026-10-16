import { isValidObjectId } from 'mongoose';
import { notFound } from 'next/navigation';
import { TranslatorForm, type TranslatorFormInitial } from '@/components/admin/translator-form';
import { requirePagePermission } from '@/lib/auth';
import { getAdminTranslatorProfile, getTranslatorUserOptions } from '@/services/admin-translators';

export const metadata = { title: 'Edit translator' };

export default async function EditTranslatorPage({ params }: PageProps<'/admin/translators/[id]'>) {
  const { user } = await requirePagePermission('content.update', '/admin/translators');
  const { id } = await params;
  if (!isValidObjectId(id)) notFound();
  const canManageUserLink = user.permissions.includes('users.update');
  const [profile, userOptions] = await Promise.all([
    getAdminTranslatorProfile(id),
    canManageUserLink ? getTranslatorUserOptions() : Promise.resolve([]),
  ]);
  if (!profile) notFound();
  const initial: TranslatorFormInitial = {
    id,
    displayName: String(profile.displayName || ''),
    slug: String(profile.slug || ''),
    bio: String(profile.bio || ''),
    avatarUrl: String(profile.avatarUrl || ''),
    userId: profile.user ? String(profile.user) : '',
    verified: Boolean(profile.verified),
    totalSubtitles: Number(profile.totalSubtitles || 0),
    totalDownloads: Number(profile.totalDownloads || 0),
  };
  return <>
    <header className="admin-page-head"><div><span>Contributor profiles</span><h1>Edit {initial.displayName}</h1><p>Update public profile details, verification, account ownership, and avatar assets. Changes are written to the audit trail.</p></div></header>
    <TranslatorForm initial={initial} canVerify={user.permissions.includes('subtitles.verify')} canManageUserLink={canManageUserLink} canUploadAvatar={user.permissions.includes('media.upload')} userOptions={userOptions}/>
  </>;
}
