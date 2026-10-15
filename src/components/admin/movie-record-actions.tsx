'use client';

import { CheckCircle2, LoaderCircle, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { readCsrfToken } from '@/lib/client/browser-brand';
import { movieArchiveConfirmation, movieArchiveRequest, moviePublishConfirmation, moviePublishRequest } from '@/lib/client/movie-actions';

type Props = {
  movieId: string;
  title: string;
  status: string;
  canEdit: boolean;
  canPublish: boolean;
  canArchive: boolean;
};

export function MovieRecordActions({ movieId, title, status, canEdit, canPublish, canArchive }: Props) {
  const router = useRouter();
  const [published, setPublished] = useState(status === 'published');
  const [archived, setArchived] = useState(false);
  const [pending, setPending] = useState<'publish' | 'archive' | ''>('');
  const [error, setError] = useState('');

  async function publish() {
    if (!window.confirm(moviePublishConfirmation(title))) return;
    setPending('publish');
    setError('');
    try {
      const request = moviePublishRequest(movieId, readCsrfToken());
      const response = await fetch(request.url, request.init);
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error?.message || 'Movie could not be published.');
      setPublished(true);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Movie could not be published.');
    } finally {
      setPending('');
    }
  }

  async function archive() {
    if (!window.confirm(movieArchiveConfirmation(title))) return;
    setPending('archive');
    setError('');
    try {
      const request = movieArchiveRequest(movieId, readCsrfToken());
      const response = await fetch(request.url, request.init);
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error?.message || 'Movie could not be deleted.');
      setArchived(true);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Movie could not be deleted.');
    } finally {
      setPending('');
    }
  }

  if (archived) return <span className="movie-archived" role="status">Movie deleted.</span>;

  return <div className="movie-record-actions">
    {canEdit && <Link className="movie-edit-button" href={`/admin/movies/${movieId}`}><Pencil/>Edit</Link>}
    {published
      ? <span className="movie-published"><CheckCircle2/>Published</span>
      : canPublish && <button type="button" className="movie-publish-button" onClick={publish} disabled={Boolean(pending)}>{pending === 'publish' ? <LoaderCircle className="spin"/> : <CheckCircle2/>}{pending === 'publish' ? 'Publishing…' : 'Publish'}</button>}
    {canArchive && <button type="button" className="movie-delete-button" onClick={archive} disabled={Boolean(pending)} aria-label={`Delete ${title}`} title="Delete movie">{pending === 'archive' ? <LoaderCircle className="spin"/> : <Trash2/>}</button>}
    {error && <small className="movie-action-error" role="alert">{error}</small>}
  </div>;
}
