'use client';

import { Copy, ExternalLink, LoaderCircle, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { readCsrfToken } from '@/lib/client/browser-brand';

type Props = {
  id: string;
  displayName: string;
  slug: string;
  canEdit: boolean;
  canDelete: boolean;
};

export function TranslatorRecordActions({ id, displayName, slug, canEdit, canDelete }: Props) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [error, setError] = useState('');

  async function copyId() {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_800);
    } catch {
      setError('Profile ID could not be copied.');
    }
  }

  async function remove() {
    if (!window.confirm(`Delete translator profile “${displayName}”? Profiles credited on subtitles cannot be deleted.`)) return;
    setDeleting(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/translators/${id}`, { method: 'DELETE', headers: { 'x-csrf-token': readCsrfToken() } });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error?.message || 'Translator profile could not be deleted.');
      setDeleted(true);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Translator profile could not be deleted.');
    } finally {
      setDeleting(false);
    }
  }

  if (deleted) return <span className="translator-deleted" role="status">Profile deleted.</span>;

  return <div className="translator-record-actions">
    <button type="button" className="translator-copy-button" onClick={() => void copyId()} title="Copy translator profile ID" aria-label={`Copy ${displayName} profile ID`}><Copy/>{copied ? 'Copied' : 'Copy ID'}</button>
    <Link className="translator-view-button" href={`/translator/${slug}`} target="_blank" rel="noreferrer"><ExternalLink/>View</Link>
    {canEdit && <Link className="subtitle-edit-button" href={`/admin/translators/${id}`}><Pencil/>Edit</Link>}
    {canDelete && <button type="button" className="subtitle-delete-button" onClick={() => void remove()} disabled={deleting} title="Delete translator" aria-label={`Delete ${displayName}`}>{deleting ? <LoaderCircle className="spin"/> : <Trash2/>}</button>}
    {error && <small className="subtitle-delete-error" role="alert">{error}</small>}
  </div>;
}
