import { AdManagementForm } from '@/components/admin/ad-management-form';
import { requirePagePermission } from '@/lib/auth';
import { adSettingsDiagnostics } from '@/lib/ads';
import { getAdSettings } from '@/services/ad-settings';

export const metadata = { title: 'Ad Management' };

export default async function AdManagementPage() {
  const [session, settings] = await Promise.all([requirePagePermission('settings.read', '/admin/ads'), getAdSettings()]);
  return <AdManagementForm initial={settings} diagnostics={adSettingsDiagnostics(settings)} canUpdate={session.user.permissions.includes('settings.update')}/>;
}
