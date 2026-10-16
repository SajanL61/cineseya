import { AdminCollectionPage } from '@/components/admin/admin-collection-page';
export const metadata={title:'Translators'};
export default async function Page({searchParams}:{searchParams:Promise<{q?:string}>}){const p=await searchParams;return <AdminCollectionPage resource="translators" title="Translators" description="Maintain credited translator profiles, account links, verification and public profile details." permission="subtitles.read" createHref="/admin/translators/new" createLabel="Add translator" query={p.q}/>;}
