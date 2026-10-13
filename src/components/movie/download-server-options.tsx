'use client';

import { CheckCircle2, Download, ExternalLink, ShieldCheck, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SafeImage } from '@/components/ui/safe-image';
import type { DownloadMirrorDto, MediaVersionDto } from '@/types/media';

const size = (bytes: number) => bytes >= 1_000_000_000 ? `${(bytes / 1_000_000_000).toFixed(2)} GB` : `${Math.max(1, bytes / 1_000_000).toFixed(0)} MB`;
const qualityLabel = (quality: string) => quality === '2160p' ? 'UHD 2160p' : quality === '1080p' ? 'FHD 1080p' : quality === '720p' ? 'HD 720p' : quality === '480p' ? 'SD 480p' : quality;
const mirrorKey = (mirror: DownloadMirrorDto) => `${mirror.providerType}:${(mirror.label || mirror.providerName).toLocaleLowerCase()}`;

type SourceRow = { key: string; serverName: string; href: string; version: MediaVersionDto; mirror?: DownloadMirrorDto; status: DownloadMirrorDto['healthStatus'] | 'verification' };

export function DownloadOptions({ title, posterUrl, versions }: { title: string; posterUrl: string; versions: MediaVersionDto[] }) {
  const [open, setOpen] = useState(false); const closeButton = useRef<HTMLButtonElement>(null);
  const rows = useMemo<SourceRow[]>(() => versions.flatMap((version) => [
    ...(version.directAvailable ? [{ key: 'direct', serverName: 'CineSeya Direct', href: `/download/${version.downloadId || version.id}`, version, status: 'verification' as const }] : []),
    ...version.mirrors.filter((mirror) => mirror.healthStatus !== 'disabled').map((mirror) => ({ key: mirrorKey(mirror), serverName: mirror.label || mirror.providerName, href: mirror.redirectPath, version, mirror, status: mirror.healthStatus })),
  ]), [versions]);
  const servers = useMemo(() => [...new Map(rows.map((row) => [row.key, row.serverName])).entries()], [rows]);
  const [activeServer, setActiveServer] = useState(servers[0]?.[0] || 'direct');
  const selectedServer = servers.some(([key]) => key === activeServer) ? activeServer : servers[0]?.[0];
  const visibleRows = rows.filter((row) => row.key === selectedServer);

  useEffect(() => { if (!open) return; const prior = document.body.style.overflow; document.body.style.overflow = 'hidden'; closeButton.current?.focus(); const key = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); }; window.addEventListener('keydown', key); return () => { document.body.style.overflow = prior; window.removeEventListener('keydown', key); }; }, [open]);
  if (!rows.length) return null;

  const dialog = open ? <div className="download-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}><section className="download-dialog server-download-dialog" role="dialog" aria-modal="true" aria-labelledby="download-dialog-title">
    <header><div className="download-dialog-title"><span><SafeImage src={posterUrl} fallbackSrc="/media/fallback-poster.svg" alt="" fill sizes="64px"/></span><div><small>Download servers</small><h2 id="download-dialog-title">{title}</h2><p>Only configured files and servers are shown.</p></div></div><button ref={closeButton} type="button" aria-label="Close download options" onClick={() => setOpen(false)}><X/></button></header>
    <div className="download-dialog-body"><nav className="download-server-tabs" aria-label="Download servers">{servers.map(([key, name]) => <button type="button" className={selectedServer === key ? 'active' : ''} onClick={() => setActiveServer(key)} key={key}>{name}</button>)}</nav>
      <div className="download-server-table"><div className="download-table-head"><span>Options</span><span>Quality</span><span>Size</span><span>Status</span></div>{visibleRows.map((row) => <a href={row.href} key={`${row.key}-${row.version.id}`}><span><b>{row.serverName}</b><small>{row.version.releaseType} · {row.version.videoCodec}{row.mirror?.requiresLogin ? ' · Login required' : ''}</small></span><span><b>{qualityLabel(row.version.quality)}</b><small>{row.version.resolution}</small></span><strong>{size(row.version.fileSize)}</strong><em className={`health-${row.status}`}>{row.status === 'verification' ? 'Verify' : row.status}</em><ExternalLink/></a>)}</div>
      <div className="download-server-cards">{visibleRows.map((row) => <a href={row.href} key={`${row.key}-${row.version.id}`}><header><b>{row.serverName}</b><em className={`health-${row.status}`}>{row.status === 'verification' ? 'Verify server' : row.status}</em></header><h3>{qualityLabel(row.version.quality)}</h3><p>{row.version.videoCodec} · {row.version.releaseType} · {size(row.version.fileSize)}</p>{row.mirror?.supportsResume && row.mirror.supportsRange && <small>Resume supported</small>}<span><Download/>Download</span></a>)}</div>
    </div><footer><CheckCircle2/><span>Every option is administrator-configured and passes CineSeya rights checks. Verification never requires advertisements.</span></footer>
  </section></div> : null;
  return <><button className="action-button download-open-button" type="button" onClick={() => setOpen(true)}><ShieldCheck/>Download</button>{dialog ? createPortal(dialog, document.body) : null}</>;
}
