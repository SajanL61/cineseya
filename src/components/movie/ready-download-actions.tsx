'use client';

import { Download, ExternalLink, LoaderCircle, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import type { DownloadMirrorDto } from '@/types/media';

export function ReadyDownloadActions({ mediaVersionId, readyToken, directAvailable, selectedMirrorId, mirrors }: { mediaVersionId: string; readyToken: string; directAvailable: boolean; selectedMirrorId?: string; mirrors: DownloadMirrorDto[] }) {
  const [pending, setPending] = useState(false); const [error, setError] = useState('');
  const selected = mirrors.find((mirror) => mirror.id === selectedMirrorId);

  async function startDirect() {
    setPending(true); setError('');
    try {
      const response = await fetch(`/api/download/${mediaVersionId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store', body: JSON.stringify({ readyToken }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error?.message || 'The secure link could not be generated.');
      window.location.assign(result.downloadUrl);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The secure link could not be generated.'); }
    finally { setPending(false); }
  }

  const mirrorHref = (id: string) => `/api/download/mirror/${id}?verification=${encodeURIComponent(readyToken)}`;
  return <div className="ready-download-actions">
    {selected ? <a className="download-start" href={mirrorHref(selected.id)}><ExternalLink/>{selected.providerType === 'telegram' ? 'Open in Telegram' : selected.label || selected.providerName}</a>
      : directAvailable && <button className="download-start" type="button" disabled={pending} onClick={() => void startDirect()}>{pending ? <LoaderCircle className="spin"/> : <Download/>}{pending ? 'Preparing…' : 'CineSeya Direct'}</button>}
    {error && <div className="download-prepare-error"><p>{error}</p><button type="button" onClick={() => void startDirect()}><RefreshCw/>Generate new link</button></div>}
    <section className="download-alternatives"><h2>More Download Options</h2>
      {selected && directAvailable && <button type="button" onClick={() => void startDirect()} disabled={pending}><span><b>CineSeya Direct</b><small>Recommended primary server</small></span><em>Secure gateway</em></button>}
      {mirrors.filter((mirror) => mirror.id !== selectedMirrorId).map((mirror) => <a href={mirrorHref(mirror.id)} key={mirror.id}><span><b>{mirror.label || mirror.providerName}</b><small>{mirror.providerType === 'telegram' ? 'Open in Telegram' : 'External mirror'}</small></span><em className={`health-${mirror.healthStatus}`}>{mirror.healthStatus}</em></a>)}
    </section>
    <section className="download-options-info"><h2>Download Options</h2>{directAvailable && <p><i className="health-online"/> <b>CineSeya Direct</b><span>Private R2 delivery</span></p>}{mirrors.map((mirror) => <p key={mirror.id}><i className={`health-${mirror.healthStatus}`}/><b>{mirror.label || mirror.providerName}</b><span>{mirror.requiresLogin ? 'Provider login required' : mirror.providerType.replace('_', ' ')}</span></p>)}</section>
  </div>;
}
