'use client';

import { LoaderCircle, Pencil, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { SubtitleEditPanel } from '@/components/admin/subtitle-edit-panel';
import { SubtitlePublishAction } from '@/components/admin/subtitle-publish-action';
import { readCsrfToken } from '@/lib/client/browser-brand';
import { subtitleDeleteConfirmation, subtitleDeleteRequest } from '@/lib/client/subtitle-deletion';

type Props = {
  subtitleId: string;
  fileName: string;
  language: string;
  contentTitle: string;
  contentType: 'movie' | 'episode';
  status: string;
  canEdit: boolean;
  canPublish: boolean;
  canDelete: boolean;
};

export function SubtitleRecordActions(props: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  async function remove() {
    const confirmed = window.confirm(subtitleDeleteConfirmation(props));
    if (!confirmed) return;

    setDeleting(true);
    setDeleteError('');
    try {
      const request = subtitleDeleteRequest(props.subtitleId, readCsrfToken());
      const response = await fetch(request.url, request.init);
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error?.message || 'Subtitle could not be deleted.');
      setDeleted(true);
      router.refresh();
    } catch (cause) {
      setDeleteError(cause instanceof Error ? cause.message : 'Subtitle could not be deleted.');
    } finally {
      setDeleting(false);
    }
  }

  if (deleted) return <span className="subtitle-deleted" role="status">Subtitle deleted.</span>;

  return <div className="subtitle-record-actions">
    {props.canEdit && <button type="button" className="subtitle-edit-button" onClick={() => setEditing(true)}><Pencil/>Edit</button>}
    <SubtitlePublishAction {...props}/>
    {props.canDelete && <button type="button" className="subtitle-delete-button" onClick={remove} disabled={deleting} aria-label={`Delete ${props.fileName}`} title="Delete subtitle">{deleting ? <LoaderCircle className="spin"/> : <Trash2/>}</button>}
    {deleteError && <small className="subtitle-delete-error" role="alert">{deleteError}</small>}
    {editing && <SubtitleEditPanel subtitleId={props.subtitleId} onClose={() => setEditing(false)}/>} 
  </div>;
}
