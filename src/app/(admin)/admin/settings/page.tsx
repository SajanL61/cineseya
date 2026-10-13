import { AdminCollectionPage } from '@/components/admin/admin-collection-page';
import { SocialSettingsForm } from '@/components/admin/social-settings-form';
import { requirePagePermission } from '@/lib/auth';
import { getSocialSettings } from '@/services/site-settings';
export const metadata={title:'Settings'};
export default async function Page({searchParams}:{searchParams:Promise<{q?:string}>}){const [p,session,settings]=await Promise.all([searchParams,requirePagePermission('settings.read','/admin/settings'),getSocialSettings()]);return <><SocialSettingsForm initial={settings} canUpdate={session.user.permissions.includes('settings.update')}/><AdminCollectionPage resource="settings" title="Site settings" description="View persisted platform configuration. Secrets remain environment-only." permission="settings.read" query={p.q}/></>;}
