import { ArrowRight, Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { AdminRecordActions } from '@/components/admin/admin-record-actions';
import { SubtitlePublishAction } from '@/components/admin/subtitle-publish-action';
import { requirePagePermission } from '@/lib/auth';
import { getAdminCollection, type ResourceKey } from '@/services/admin';
import { canPublishSubtitle, type Permission } from '@/types/auth';

type Props = { resource: ResourceKey; title: string; description: string; permission: Permission; createHref?: string; query?: string; page?: number };
const display = (value: unknown) => typeof value === 'boolean' ? (value ? 'Yes' : 'No') : Array.isArray(value) ? value.join(', ') : value && typeof value === 'object' ? JSON.stringify(value) : String(value ?? '—');

export async function AdminCollectionPage({ resource, title, description, permission, createHref, query = '', page = 1 }: Props) {
  const session = await requirePagePermission(permission, `/admin/${resource}`);
  const data = await getAdminCollection(resource, query, page);
  const canPublish = canPublishSubtitle(session.user.permissions);

  return <>
    <header className="admin-page-head"><div><span>Content operations</span><h1>{title}</h1><p>{description}</p></div>{createHref && session.user.permissions.includes('content.create') && <Link className="admin-primary" href={createHref}><Plus/> Add new</Link>}</header>
    <form className="admin-search"><Search/><input name="q" defaultValue={query} placeholder={`Search ${title.toLowerCase()}`}/><button>Search</button></form>
    <section className="admin-panel"><div className="admin-panel-head"><h2>{data.total.toLocaleString()} records</h2><span>Showing up to 30</span></div>{data.items.length ? <div className="admin-table">
      <div className={`admin-table-row admin-table-labels${resource === 'subtitles' ? ' admin-subtitle-row' : ''}`}><span>Record</span><span>Status / details</span><span>Updated</span><span>{resource === 'subtitles' ? 'Actions' : ''}</span></div>
      {data.items.map((item) => {
        const id = String(item._id);
        const recordTitle = display(item[data.titleField]);
        const detail = data.secondaryField ? display(item[data.secondaryField]) : display(item.status ?? item.publicationStatus ?? item.role);
        const status = String(item.status ?? item.publicationStatus ?? item.rightsStatus ?? item.role ?? item.kind ?? item.enabled ?? '');
        const editHref = resource === 'movies' ? `/admin/movies/${id}` : resource === 'series' ? `/admin/series/${id}` : undefined;
        const canModerate = session.user.permissions.includes('moderation.update');
        const canUpdateUsers = session.user.permissions.includes('users.update');

        return <div className={`admin-table-row${resource === 'subtitles' ? ' admin-subtitle-row' : ''}`} key={id}>
          <span><b>{recordTitle}</b><small>{detail}</small></span>
          <span>{resource === 'subtitles' ? <span className={`admin-subtitle-status ${status}`}>{status || 'Unknown'}</span> : display(status)}</span>
          <time>{item.updatedAt || item.createdAt ? new Date(String(item.updatedAt || item.createdAt)).toLocaleDateString('en-LK') : '—'}</time>
          {resource === 'subtitles'
            ? <SubtitlePublishAction subtitleId={id} fileName={recordTitle} language={detail} contentTitle={String(item.contentTitle ?? 'Unknown linked content')} contentType={item.contentType === 'episode' ? 'episode' : 'movie'} status={status} canPublish={canPublish}/>
            : editHref
              ? <Link href={editHref} aria-label={`Open ${recordTitle}`}><ArrowRight/></Link>
              : <AdminRecordActions resource={resource} id={id} currentStatus={item.status ? String(item.status) : undefined} currentRole={item.role ? String(item.role) : undefined} active={item.active !== false} canUpdate={resource === 'users' ? canUpdateUsers : canModerate} canChangeRole={resource === 'users' && session.user.permissions.includes('users.roles')}/>}
        </div>;
      })}
    </div> : <div className="admin-empty"><b>No records found</b><p>{query ? 'Try a broader search.' : 'This isolated CineSeya.lk collection is ready for its first record.'}</p></div>}</section>
  </>;
}
