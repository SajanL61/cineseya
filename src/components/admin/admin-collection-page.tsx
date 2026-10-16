import { ArrowRight, Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { AdminRecordActions } from '@/components/admin/admin-record-actions';
import { MovieRecordActions } from '@/components/admin/movie-record-actions';
import { SubtitleRecordActions } from '@/components/admin/subtitle-record-actions';
import { TranslatorRecordActions } from '@/components/admin/translator-record-actions';
import { requirePagePermission } from '@/lib/auth';
import { getAdminCollection, type ResourceKey } from '@/services/admin';
import { canArchiveMovie, canDeleteSubtitle, canEditSubtitle, canPublishMovie, canPublishSubtitle, type Permission } from '@/types/auth';

type Props = { resource: ResourceKey; title: string; description: string; permission: Permission; createHref?: string; createLabel?: string; query?: string; page?: number };
const display = (value: unknown) => typeof value === 'boolean' ? (value ? 'Yes' : 'No') : Array.isArray(value) ? value.join(', ') : value && typeof value === 'object' ? JSON.stringify(value) : String(value ?? '—');

export async function AdminCollectionPage({ resource, title, description, permission, createHref, createLabel = 'Add new', query = '', page = 1 }: Props) {
  const session = await requirePagePermission(permission, `/admin/${resource}`);
  const data = await getAdminCollection(resource, query, page);
  const canPublish = canPublishSubtitle(session.user.permissions);
  const rowClass = resource === 'subtitles' ? ' admin-subtitle-row' : resource === 'movies' ? ' admin-movie-row' : resource === 'translators' ? ' admin-translator-row' : '';

  return <>
    <header className="admin-page-head"><div><span>Content operations</span><h1>{title}</h1><p>{description}</p></div>{createHref && session.user.permissions.includes('content.create') && <Link className="admin-primary" href={createHref}><Plus/> {createLabel}</Link>}</header>
    <form className="admin-search"><Search/><input name="q" defaultValue={query} placeholder={`Search ${title.toLowerCase()}`}/><button>Search</button></form>
    <section className="admin-panel"><div className="admin-panel-head"><h2>{data.total.toLocaleString()} records</h2><span>Showing up to 30</span></div>{data.items.length ? <div className="admin-table">
      <div className={`admin-table-row admin-table-labels${rowClass}`}><span>Record</span><span>Status / details</span><span>Updated</span><span>{resource === 'subtitles' || resource === 'movies' || resource === 'translators' ? 'Actions' : ''}</span></div>
      {data.items.map((item) => {
        const id = String(item._id);
        const recordTitle = display(item[data.titleField]);
        const detail = data.secondaryField ? display(item[data.secondaryField]) : display(item.status ?? item.publicationStatus ?? item.role);
        const status = String(item.status ?? item.publicationStatus ?? item.rightsStatus ?? item.role ?? item.kind ?? item.enabled ?? '');
        const editHref = resource === 'movies' ? `/admin/movies/${id}` : resource === 'series' ? `/admin/series/${id}` : undefined;
        const canModerate = session.user.permissions.includes('moderation.update');
        const canUpdateUsers = session.user.permissions.includes('users.update');

        return <div className={`admin-table-row${rowClass}`} key={id}>
          <span><b>{recordTitle}</b><small>{detail}</small></span>
          <span>{resource === 'subtitles' ? <span className={`admin-subtitle-status ${status}`}>{status || 'Unknown'}</span> : resource === 'movies' ? <span className={`admin-movie-status ${status}`}>{status || 'Unknown'}</span> : resource === 'translators' ? <span className="admin-translator-details"><b className={item.verified ? 'verified' : ''}>{item.verified ? 'Verified' : 'Unverified'}</b><small>{Number(item.totalSubtitles || 0).toLocaleString()} subtitles · {Number(item.totalDownloads || 0).toLocaleString()} downloads</small></span> : display(status)}</span>
          <time>{item.updatedAt || item.createdAt ? new Date(String(item.updatedAt || item.createdAt)).toLocaleDateString('en-LK') : '—'}</time>
          {resource === 'subtitles'
            ? <SubtitleRecordActions subtitleId={id} fileName={recordTitle} language={detail} contentTitle={String(item.contentTitle ?? 'Unknown linked content')} contentType={item.contentType === 'episode' ? 'episode' : 'movie'} status={status} canEdit={canEditSubtitle(session.user.permissions, status)} canPublish={canPublish} canDelete={canDeleteSubtitle(session.user.permissions)}/>
            : resource === 'movies'
              ? <MovieRecordActions movieId={id} title={recordTitle} status={status} canEdit={session.user.permissions.includes('content.update')} canPublish={canPublishMovie(session.user.permissions)} canArchive={canArchiveMovie(session.user.permissions)}/>
            : resource === 'translators'
              ? <TranslatorRecordActions id={id} displayName={recordTitle} slug={String(item.slug || '')} canEdit={session.user.permissions.includes('content.update')} canDelete={session.user.permissions.includes('subtitles.delete')}/>
            : editHref
              ? <Link href={editHref} aria-label={`Open ${recordTitle}`}><ArrowRight/></Link>
              : <AdminRecordActions resource={resource} id={id} currentStatus={item.status ? String(item.status) : undefined} currentRole={item.role ? String(item.role) : undefined} active={item.active !== false} canUpdate={resource === 'users' ? canUpdateUsers : canModerate} canChangeRole={resource === 'users' && session.user.permissions.includes('users.roles')}/>}
        </div>;
      })}
    </div> : <div className="admin-empty"><b>No records found</b><p>{query ? 'Try a broader search.' : 'This isolated CineSeya.lk collection is ready for its first record.'}</p></div>}</section>
  </>;
}
