'use client';

import { CheckCircle2, ChevronDown, Download, ExternalLink, HardDriveDownload, RotateCcw, ShieldCheck, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SafeImage } from '@/components/ui/safe-image';
import type { DownloadMirrorDto, MediaVersionDto } from '@/types/media';

const size = (bytes: number) => bytes >= 1_000_000_000 ? `${(bytes / 1_000_000_000).toFixed(1)} GB` : `${Math.max(1, bytes / 1_000_000).toFixed(0)} MB`;

function MirrorLink({ mirror, prominent = false }: { mirror: DownloadMirrorDto; prominent?: boolean }) {
  return <a className={prominent ? 'download-fast-link' : 'download-mirror-link'} href={mirror.redirectPath}>
    <span><b>{prominent ? 'Fast Download' : mirror.providerName}</b><small>{mirror.supportsResume ? 'Resume supported' : mirror.providerType.replace('_', ' ')}</small></span>
    <em className={`source-health health-${mirror.healthStatus}`}>{mirror.healthStatus === 'online' ? '● Online' : mirror.healthStatus === 'unavailable' ? '○ Unavailable' : '○ Not checked'}</em>
    <ExternalLink/>
  </a>;
}

function VersionGroup({ version }: { version: MediaVersionDto }) {
  const [mirrorsOpen, setMirrorsOpen] = useState(false);
  const [fast, ...more] = version.mirrors;
  const labels = [version.releaseType, version.videoCodec, version.audioCodec, ...version.audioLanguages.map((item) => `${item} Audio`), ...version.embeddedSubtitleLanguages.map((item) => `${item} Sub`)];
  return <section className="download-version-group">
    <header><div><span>{version.quality}</span><h3>{version.resolution}</h3></div><b>{size(version.fileSize)}</b></header>
    <div className="download-version-tags">{labels.filter(Boolean).map((label) => <span key={label}>{label}</span>)}</div>
    <div className="download-source-block"><small>Primary</small>{version.directAvailable
      ? <a className="download-direct-link" href={`/download/${version.downloadId || version.id}`}><span><b>CineSeya.lk Direct</b><small><ShieldCheck/> Recommended · Resume supported</small></span><HardDriveDownload/></a>
      : <div className="download-source-unavailable"><RotateCcw/><span><b>Direct download unavailable</b><small>Configure the private media bucket or use an active mirror.</small></span></div>}
    </div>
    {fast && <div className="download-source-block"><small>Secondary</small><MirrorLink mirror={fast} prominent/></div>}
    {more.length > 0 && <div className="download-mirrors"><button type="button" aria-expanded={mirrorsOpen} onClick={() => setMirrorsOpen((value) => !value)}>More mirrors <ChevronDown/></button>{mirrorsOpen && <div>{more.map((mirror) => <MirrorLink mirror={mirror} key={mirror.id}/>)}</div>}</div>}
    {!version.directAvailable && !version.mirrors.length && <p className="all-sources-unavailable">This version is temporarily unavailable.</p>}
  </section>;
}

export function DownloadOptions({ title, posterUrl, versions }: { title: string; posterUrl: string; versions: MediaVersionDto[] }) {
  const [open, setOpen] = useState(false);
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (!open) return; const prior = document.body.style.overflow; document.body.style.overflow = 'hidden'; closeButton.current?.focus(); const key = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); }; window.addEventListener('keydown', key); return () => { document.body.style.overflow = prior; window.removeEventListener('keydown', key); }; }, [open]);
  if (!versions.length) return null;
  const dialog = open ? <div className="download-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}><section className="download-dialog" role="dialog" aria-modal="true" aria-labelledby="download-dialog-title"><header><div className="download-dialog-title"><span><SafeImage src={posterUrl} fallbackSrc="/media/fallback-poster.svg" alt="" fill sizes="64px"/></span><div><small>Download options</small><h2 id="download-dialog-title">{title}</h2><p>Choose a verified quality and source.</p></div></div><button ref={closeButton} type="button" aria-label="Close download options" onClick={() => setOpen(false)}><X/></button></header><div className="download-dialog-body">{versions.map((version) => <VersionGroup version={version} key={version.id}/>)}</div><footer><CheckCircle2/><span>Every source shown here is attached by an administrator. CineSeya.lk never uses fake verification steps.</span></footer></section></div> : null;
  return <><button className="action-button download-open-button" type="button" onClick={() => setOpen(true)}><Download/>Download</button>{dialog ? createPortal(dialog, document.body) : null}</>;
}
