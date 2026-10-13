'use client';

import { Ban, CheckCircle2, CloudUpload, LoaderCircle, Pause, Play, RotateCcw } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { readCsrfToken } from '@/lib/client/browser-brand';
import { uploadApiFetch as fetch } from '@/lib/client/upload-json';

export type JobRow = { _id: string; status: string; currentStage?: string; progressPercent?: number; requestedRenditions?: string[]; completedRenditions?: Array<{ name?: string }>; safeErrorMessage?: string; createdAt?: string };
const csrf = readCsrfToken;
const size = (bytes: number) => bytes >= 1_000_000_000 ? `${(bytes / 1_000_000_000).toFixed(2)} GB` : `${(bytes / 1_000_000).toFixed(1)} MB`;
const mime = (file: File) => file.type || ({ mkv: 'video/x-matroska', mov: 'video/quicktime', webm: 'video/webm' }[file.name.split('.').pop()?.toLowerCase() || ''] || 'video/mp4');
const delay = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

function put(url: string, body: Blob, signal: AbortSignal, onProgress: (loaded: number) => void) {
  return new Promise<string>((resolve, reject) => {
    const request = new XMLHttpRequest(); request.open('PUT', url); request.upload.onprogress = (event) => onProgress(event.loaded);
    request.onerror = () => reject(new Error('R2 rejected the master upload. Check bucket CORS and network access.'));
    request.onload = () => request.status >= 200 && request.status < 300 ? resolve(request.getResponseHeader('ETag') || '') : reject(new Error(`R2 rejected the upload (${request.status}).`));
    const abort = () => { request.abort(); reject(new DOMException('Upload cancelled.', 'AbortError')); };
    signal.addEventListener('abort', abort, { once: true }); request.onloadend = () => signal.removeEventListener('abort', abort); request.send(body);
  });
}

export function MasterStreamUpload({ contentId, rightsStatus, initialJobs }: { contentId: string; rightsStatus: string; initialJobs: JobRow[] }) {
  const router = useRouter(); const fileInput = useRef<HTMLInputElement>(null); const abortRef = useRef<AbortController | null>(null); const pausedRef = useRef(false);
  const [pending, setPending] = useState(false); const [paused, setPaused] = useState(false); const [percent, setPercent] = useState(0); const [progress, setProgress] = useState(''); const [error, setError] = useState('');
  const allowed = ['owned', 'licensed', 'public_domain'].includes(rightsStatus);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const file = fileInput.current?.files?.[0];
    if (!file) { setError('Choose an MP4, MKV, MOV, or WEBM master video.'); return; }
    const controller = new AbortController(); abortRef.current = controller; pausedRef.current = false; setPaused(false); setPending(true); setError(''); setPercent(0);
    const headers = { 'Content-Type': 'application/json', 'x-csrf-token': csrf() }; const startedAt = performance.now(); let multipart: { assetId: string; uploadId: string } | null = null;
    const report = (loaded: number, part: string) => { const seconds = Math.max(.1, (performance.now() - startedAt) / 1_000); const speed = loaded / seconds; const eta = speed ? (file.size - loaded) / speed : 0; setPercent(Math.round(loaded / file.size * 100)); setProgress(`${part} · ${size(loaded)} of ${size(file.size)} · ${(speed / 1_000_000).toFixed(1)} MB/s · ${Math.ceil(eta / 60)} min ETA`); };
    try {
      const startResponse = await fetch('/api/admin/uploads/multipart/start', { method: 'POST', headers, signal: controller.signal, body: JSON.stringify({ kind: 'media', purpose: 'stream_master', fileName: file.name, contentType: mime(file), size: file.size, linkedModel: 'Movie', linkedId: contentId }) });
      const ticket = await startResponse.json(); if (!startResponse.ok) throw new Error(ticket.error?.message || 'Master upload could not start.'); multipart = ticket;
      const partCount = Math.ceil(file.size / ticket.partSize); const parts: { ETag: string; PartNumber: number }[] = []; let uploaded = 0;
      for (let index = 0; index < partCount; index++) {
        while (pausedRef.current) { setProgress(`Paused before part ${index + 1} of ${partCount}`); await delay(250); if (controller.signal.aborted) throw new DOMException('Upload cancelled.', 'AbortError'); }
        const partNumber = index + 1; const chunk = file.slice(index * ticket.partSize, Math.min(file.size, (index + 1) * ticket.partSize)); let etag = '';
        for (let attempt = 1; attempt <= 3 && !etag; attempt++) {
          try {
            const signedResponse = await fetch(`/api/admin/uploads/multipart/${ticket.assetId}/part`, { method: 'POST', headers, signal: controller.signal, body: JSON.stringify({ uploadId: ticket.uploadId, partNumber }) });
            const signed = await signedResponse.json(); if (!signedResponse.ok) throw new Error(signed.error?.message || `Part ${partNumber} could not be signed.`);
            etag = await put(signed.uploadUrl, chunk, controller.signal, (partLoaded) => report(uploaded + partLoaded, `Part ${partNumber}/${partCount}`));
            if (!etag) throw new Error('R2 did not expose ETag. Add ETag to the bucket CORS exposeHeaders list.');
          } catch (cause) { if (cause instanceof DOMException && cause.name === 'AbortError') throw cause; if (attempt === 3) throw cause; await delay(700 * attempt); }
        }
        parts.push({ ETag: etag, PartNumber: partNumber }); uploaded += chunk.size; report(uploaded, `Part ${partNumber}/${partCount}`);
      }
      setProgress('Finalizing master upload…');
      const completeResponse = await fetch(`/api/admin/uploads/multipart/${ticket.assetId}/complete`, { method: 'POST', headers, signal: controller.signal, body: JSON.stringify({ uploadId: ticket.uploadId, parts }) });
      const complete = await completeResponse.json(); if (!completeResponse.ok) throw new Error(complete.error?.message || 'Master upload could not be finalized.');
      multipart = null;
      setProgress('Master uploaded. Queuing transcoding…');
      const requestedRenditions = ['360p', '480p', '720p', '1080p'].filter((quality) => form.has(quality));
      const queueResponse = await fetch('/api/admin/transcoding/jobs', { method: 'POST', headers, body: JSON.stringify({ assetId: complete.asset.id, contentId, contentType: 'movie', requestedRenditions, language: String(form.get('language') || ''), defaultAudio: String(form.get('defaultAudio') || ''), subtitleHandling: String(form.get('subtitleHandling') || 'separate'), notes: String(form.get('notes') || ''), keepMaster: true }) });
      const queued = await queueResponse.json(); if (!queueResponse.ok) throw new Error(queued.error?.message || 'The transcode job could not be queued.');
      setPercent(100); setProgress(queued.existing ? 'This master is already queued or processed.' : 'Queued for the background transcoder.'); if (fileInput.current) fileInput.current.value = ''; router.refresh();
    } catch (cause) {
      if (multipart) await fetch(`/api/admin/uploads/multipart/${multipart.assetId}`, { method: 'DELETE', headers, body: JSON.stringify({ uploadId: multipart.uploadId }) }).catch(() => undefined);
      setError(cause instanceof DOMException && cause.name === 'AbortError' ? 'Master upload cancelled.' : cause instanceof Error ? cause.message : 'Master upload failed.'); setProgress(''); setPercent(0);
    } finally { abortRef.current = null; setPending(false); }
  }

  async function retry(jobId: string) { const response = await fetch(`/api/admin/transcoding/jobs/${jobId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf() }, body: JSON.stringify({ action: 'retry' }) }); if (response.ok) router.refresh(); else setError((await response.json()).error?.message || 'Retry failed.'); }
  async function cancel(jobId: string) { const response = await fetch(`/api/admin/transcoding/jobs/${jobId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf() }, body: JSON.stringify({ action: 'cancel' }) }); if (response.ok) router.refresh(); else setError((await response.json()).error?.message || 'Cancel failed.'); }

  return <section className="master-stream-upload"><header><CloudUpload/><div><span>Streaming master</span><h2>Adaptive HLS</h2><p>Upload one authorized source. A separate worker creates browser-compatible qualities without upscaling.</p></div></header>
    {!allowed ? <p className="admin-form-error">Set this title’s rights to owned, licensed, or public domain before uploading full media.</p> : <form onSubmit={submit}><div className="master-fields"><label>Source file<input ref={fileInput} type="file" accept=".mp4,.mkv,.mov,.webm,video/mp4,video/x-matroska,video/quicktime,video/webm" required disabled={pending}/></label><label>Language<input name="language" placeholder="English"/></label><label>Default audio<input name="defaultAudio" placeholder="English"/></label><label>Subtitle handling<select name="subtitleHandling"><option value="separate">Keep separate</option><option value="ignore">Ignore embedded</option></select></label><label className="span-2">Notes<input name="notes" placeholder="Source provenance or processing notes"/></label></div><fieldset><legend>Automatic outputs (source resolution is the hard maximum)</legend>{['360p','480p','720p','1080p'].map((quality)=><label key={quality}><input type="checkbox" name={quality} defaultChecked/>{quality}</label>)}</fieldset><div className="media-upload-actions"><button className="admin-primary" disabled={pending}>{pending?<LoaderCircle className="spin"/>:<CloudUpload/>}{pending?'Uploading':'Upload master & queue'}</button>{pending&&<><button type="button" onClick={() => { pausedRef.current = !pausedRef.current; setPaused(pausedRef.current); }}>{paused?<Play/>:<Pause/>}{paused?'Resume':'Pause after part'}</button><button className="admin-danger" type="button" onClick={() => abortRef.current?.abort()}><Ban/>Cancel</button></>}</div>{progress&&<><div className="upload-meter"><i style={{width:`${percent}%`}}/></div><p className="upload-progress"><CheckCircle2/>{progress}</p></>}{error&&<p className="admin-form-error">{error}</p>}</form>}
    <div className="transcode-job-list">{initialJobs.map((job)=><article key={job._id}><div><b>{job.status}</b><span>{String(job.currentStage || 'queued').replaceAll('_',' ')} · {Math.round(Number(job.progressPercent || 0))}%</span><small>{job.completedRenditions?.map((item)=>item.name).filter(Boolean).join(', ') || job.requestedRenditions?.join(', ') || 'Automatic qualities'}</small></div><progress max="100" value={Number(job.progressPercent || 0)}/>{['processing','uploading','queued'].includes(job.status)&&<button type="button" onClick={()=>cancel(job._id)}><Ban/>Cancel</button>}{['failed','cancelled'].includes(job.status)&&<button type="button" onClick={()=>retry(job._id)}><RotateCcw/>Retry</button>}</article>)}</div>
  </section>;
}
