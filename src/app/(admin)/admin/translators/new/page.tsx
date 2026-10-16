import { TranslatorForm } from '@/components/admin/translator-form';
import { requirePagePermission } from '@/lib/auth';
import { getTranslatorUserOptions } from '@/services/admin-translators';

export const metadata = { title: 'Add translator' };

export default async function NewTranslatorPage() {
  const { user } = await requirePagePermission('content.create', '/admin/translators/new');
  const canManageUserLink = user.permissions.includes('users.update');
  const userOptions = canManageUserLink ? await getTranslatorUserOptions() : [];
  return <>
    <header className="admin-page-head"><div><span>Contributor profiles</span><h1>Add translator</h1><p>Create a credited profile, optionally link its login account, and copy the generated profile ID for subtitle records.</p></div></header>
    <TranslatorForm canVerify={user.permissions.includes('subtitles.verify')} canManageUserLink={canManageUserLink} canUploadAvatar={user.permissions.includes('media.upload')} userOptions={userOptions}/>
  </>;
}
