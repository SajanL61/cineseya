'use client';

import { AlertTriangle, CheckCircle2, FilePenLine, LoaderCircle, Save, Search, Upload, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { readCsrfToken } from '@/lib/client/browser-brand';
import { uploadApiFetch } from '@/lib/client/upload-json';
import {
  subtitleAssociationChanged, subtitleAssociationConfirmation, subtitleEditPayload,
  type SubtitleEditableRecord, type SubtitleEditValues, type SubtitleSelection,
} from '@/lib/client/subtitle-editing';

type LookupType = 'movie' | 'episode' | 'translator';
type LookupItem = SubtitleSelection & { title?: string; year?: number; seriesTitle?: string; seasonNumber?: number; episodeNumber?: number; verified?: boolean };

const mimeFor = (file: File) => file.type || ({ srt: 'application/x-subrip', vtt: 'text/vtt', ass: 'application/x-ass', zip: 'application/zip' }[file.name.split('.').pop()?.toLocaleLowerCase() || ''] || 'application/octet-stream');
const bytes = (value: number) => value >= 1_000_000 ? `${(value / 1_000_000).toFixed(1)} MB` : `${Math.ceil(value / 1_000)} KB`;
const valuesFrom = (record: SubtitleEditableRecord): SubtitleEditValues => ({
  contentType: record.contentType,
  content: { id: record.contentId, label: record.contentLabel },
  translator: { id: record.translatorId, label: record.translatorLabel },
  language: record.language,
  languageCode: record.languageCode,
  releaseMatches: record.releaseMatches,
  fps: record.fps,
  version: record.version,
  hearingImpaired: record.hearingImpaired,
});

function LookupPicker({ type, label, selected, onSelect, disabled }: { type: LookupType; label: string; selected: SubtitleSelection | null; onSelect: (item: LookupItem) => void; disabled?: boolean }) {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<LookupItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function search() {
    setLoading(true); setError('');
    try {
      const response = await fetch(`/api/admin/subtitle-lookups?type=${type}&q=${encodeURIComponent(query)}`, { cache: 'no-store' });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error?.message || `${label} search failed.`);
      setItems(Array.isArray(result.items) ? result.items : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `${label} search failed.`);
    } finally {
      setLoading(false);
    }
  }

  return <div className="subtitle-lookup">
    <label>{label}</label>
    <div className="subtitle-current-selection">{selected ? <><b>{selected.label}</b><small>Selected record</small></> : <><b>No record selected</b><small>Search and select a record below.</small></>}</div>
    <div className="subtitle-lookup-search"><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void search(); } }} placeholder={`Search ${label.toLocaleLowerCase()}…`} disabled={disabled}/><button type="button" onClick={() => void search()} disabled={disabled || loading}>{loading ? <LoaderCircle className="spin"/> : <Search/>}Search</button></div>
    {error && <small className="subtitle-edit-error" role="alert">{error}</small>}
    {items.length > 0 && <div className="subtitle-lookup-results" role="listbox" aria-label={`${label} results`}>{items.map((item) => <button type="button" role="option" aria-selected={selected?.id === item.id} key={item.id} onClick={() => { onSelect(item); setItems([]); }} disabled={disabled}><b>{item.label}</b>{item.verified !== undefined && <small>{item.verified ? 'Verified profile' : 'Unverified profile'}</small>}</button>)}</div>}
  </div>;
}

export function SubtitleEditPanel({ subtitleId, onClose }: { subtitleId: string; onClose: () => void }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [record, setRecord] = useState<SubtitleEditableRecord | null>(null);
  const [values, setValues] = useState<SubtitleEditValues | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [replaceFile, setReplaceFile] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/admin/subtitles/${encodeURIComponent(subtitleId)}`, { cache: 'no-store', signal: controller.signal }).then(async (response) => {
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error?.message || 'Subtitle details could not be loaded.');
      const next = result.subtitle as SubtitleEditableRecord;
      setRecord(next); setValues(valuesFrom(next));
    }).catch((cause) => { if (!(cause instanceof DOMException && cause.name === 'AbortError')) setError(cause instanceof Error ? cause.message : 'Subtitle details could not be loaded.'); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [subtitleId]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const beforeUnload = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); };
    const keyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || saving) return;
      if (!dirty || window.confirm('Discard your unsaved subtitle changes?')) onClose();
    };
    window.addEventListener('beforeunload', beforeUnload);
    window.addEventListener('keydown', keyDown);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('beforeunload', beforeUnload); window.removeEventListener('keydown', keyDown); };
  }, [dirty, onClose, saving]);

  function close() {
    if (saving) return;
    if (dirty && !window.confirm('Discard your unsaved subtitle changes?')) return;
    onClose();
  }

  function update<K extends keyof SubtitleEditValues>(field: K, value: SubtitleEditValues[K]) {
    setValues((current) => current ? { ...current, [field]: value } : current);
    setDirty(true); setSuccess('');
  }

  async function uploadReplacement(file: File) {
    const headers = { 'Content-Type': 'application/json', 'x-csrf-token': readCsrfToken() };
    const signed = await uploadApiFetch('/api/admin/uploads/presign', { method: 'POST', headers, body: JSON.stringify({ kind: 'subtitle', fileName: file.name, contentType: mimeFor(file), size: file.size, replacementFor: subtitleId }) });
    const ticket = await signed.json();
    if (!signed.ok) throw new Error(ticket.error?.message || 'Replacement upload could not be signed.');
    const sent = await globalThis.fetch(ticket.uploadUrl, { method: 'PUT', headers: ticket.headers, body: file });
    if (!sent.ok) throw new Error(`R2 rejected the replacement upload (${sent.status}).`);
    const completed = await uploadApiFetch(`/api/admin/uploads/${ticket.assetId}/complete`, { method: 'POST', headers: { 'x-csrf-token': readCsrfToken() } });
    const completion = await completed.json();
    if (!completed.ok) throw new Error(completion.error?.message || 'The replacement file could not be validated.');
    return String(completion.asset.id);
  }

  async function save() {
    if (!record || !values) return;
    if (!values.content.id) { setError('Select a movie or episode.'); return; }
    if (!values.translator.id) { setError('Select a translator profile.'); return; }
    if (!values.language.trim() || !values.languageCode.trim() || !values.releaseMatches.length) { setError('Language, language code, and at least one matched release are required.'); return; }
    if (subtitleAssociationChanged(record, values) && !window.confirm(subtitleAssociationConfirmation(record, values))) return;
    const replacement = replaceFile ? fileInput.current?.files?.[0] : undefined;
    if (replaceFile && !replacement) { setError('Choose a replacement subtitle file.'); return; }

    setSaving(true); setError(''); setSuccess('');
    try {
      const replacementAssetId = replacement ? await uploadReplacement(replacement) : undefined;
      const response = await fetch(`/api/admin/subtitles/${encodeURIComponent(subtitleId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': readCsrfToken() },
        body: JSON.stringify(subtitleEditPayload(record, values, replacementAssetId)),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error?.code === 'EDIT_CONFLICT' ? 'Another administrator saved newer changes. Close this panel, reopen it, and review the latest values.' : result.error?.message || 'Subtitle changes could not be saved.');
      const next = result.subtitle as SubtitleEditableRecord;
      setRecord(next); setValues(valuesFrom(next)); setDirty(false); setReplaceFile(false);
      if (fileInput.current) fileInput.current.value = '';
      setSuccess('Subtitle changes saved successfully.');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Subtitle changes could not be saved. The original subtitle remains unchanged.');
    } finally {
      setSaving(false);
    }
  }

  return <div className="subtitle-edit-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
    <section className="subtitle-edit-panel" role="dialog" aria-modal="true" aria-labelledby="subtitle-edit-title">
      <header><div><FilePenLine/><span><small>Subtitle record</small><h2 id="subtitle-edit-title">Edit subtitle</h2></span></div><button type="button" onClick={close} disabled={saving} aria-label="Close subtitle editor"><X/></button></header>
      {loading ? <div className="subtitle-edit-loading"><LoaderCircle className="spin"/>Loading latest saved subtitle…</div> : error && !record ? <div className="subtitle-edit-load-error"><AlertTriangle/><p>{error}</p><button type="button" onClick={close}>Close</button></div> : record && values ? <div className="subtitle-edit-body">
        <section className="subtitle-edit-file-summary"><div><span>Current file</span><b>{record.fileName}</b><small>{record.format.toUpperCase()} · {bytes(record.fileSize)} · Version {record.version} · {record.downloadCount.toLocaleString()} downloads</small></div><div className="subtitle-edit-status"><span className={`admin-subtitle-status ${record.status}`}>{record.status}</span><span className={record.verified ? 'verified' : 'unverified'}>{record.verified ? 'Verified' : 'Not verified'}</span></div></section>
        {(record.contentMissing || record.translatorMissing) && <p className="admin-form-error"><AlertTriangle/>{record.contentMissing ? 'The previously linked movie or episode is missing. Select a valid replacement.' : 'The previously linked translator profile is missing. Select a valid translator.'}</p>}
        <div className="subtitle-edit-grid">
          <label>Content type<select value={values.contentType} onChange={(event) => { update('contentType', event.target.value as 'movie' | 'episode'); update('content', { id: '', label: '' }); }} disabled={saving}><option value="movie">Movie</option><option value="episode">Episode</option></select></label>
          <LookupPicker key={values.contentType} type={values.contentType} label={values.contentType === 'movie' ? 'Linked movie' : 'Linked episode'} selected={values.content.id ? values.content : null} onSelect={(item) => update('content', item)} disabled={saving}/>
          <LookupPicker type="translator" label="Translator" selected={values.translator.id ? values.translator : null} onSelect={(item) => update('translator', item)} disabled={saving}/>
          <label>Language<input value={values.language} onChange={(event) => update('language', event.target.value)} disabled={saving}/></label>
          <label>Language code<input value={values.languageCode} onChange={(event) => update('languageCode', event.target.value)} disabled={saving}/></label>
          <label className="span-2">Matched releases<input value={values.releaseMatches.join(', ')} onChange={(event) => update('releaseMatches', event.target.value.split(',').map((value) => value.trim()).filter(Boolean))} placeholder="1080p WEB-DL, BluRay" disabled={saving}/><small>Comma-separated release names.</small></label>
          <label>Frame rate<input type="number" min="1" max="240" step="0.001" value={values.fps ?? ''} onChange={(event) => update('fps', event.target.value ? Number(event.target.value) : null)} disabled={saving}/></label>
          <label>Version<input type="number" min="1" max="100" value={values.version} onChange={(event) => update('version', Number(event.target.value))} disabled={saving || replaceFile}/><small>{replaceFile ? 'Automatically increments after replacement.' : 'Release version.'}</small></label>
          <label className="subtitle-check"><input type="checkbox" checked={values.hearingImpaired} onChange={(event) => update('hearingImpaired', event.target.checked)} disabled={saving}/> Hearing-impaired captions</label>
        </div>
        <section className="subtitle-replacement"><label><input type="checkbox" checked={replaceFile} onChange={(event) => { setReplaceFile(event.target.checked); setDirty(true); setSuccess(''); }} disabled={saving}/><span><b>Replace subtitle file</b><small>Optional. Metadata changes do not upload a file.</small></span></label>{replaceFile && <div><Upload/><input ref={fileInput} type="file" accept=".srt,.vtt,.ass,.zip" onChange={() => { setDirty(true); setSuccess(''); }} disabled={saving}/><small>The original file remains active until this replacement is uploaded, validated, and saved.</small></div>}</section>
        {error && <p className="admin-form-error" role="alert"><AlertTriangle/>{error}</p>}
        {success && <p className="admin-success" role="status"><CheckCircle2/>{success}</p>}
      </div> : null}
      {!loading && record && values && <footer><button type="button" className="subtitle-cancel" onClick={close} disabled={saving}>Cancel</button><button type="button" className="admin-primary" onClick={() => void save()} disabled={saving || !dirty}>{saving ? <LoaderCircle className="spin"/> : <Save/>}{saving ? 'Saving…' : 'Save Changes'}</button></footer>}
    </section>
  </div>;
}
