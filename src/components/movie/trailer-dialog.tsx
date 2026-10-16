'use client';

import { Play, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { youtubeEmbedUrl } from '@/lib/youtube';

export function TrailerDialog({ title, url, variant = 'button' }: { title: string; url: string; variant?: 'button' | 'icon' }) {
  const embedUrl = youtubeEmbedUrl(url);
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const prior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const key = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    addEventListener('keydown', key);
    return () => { document.body.style.overflow = prior; removeEventListener('keydown', key); };
  }, [open]);
  if (!embedUrl) return null;

  return <>
    <button className={variant === 'icon' ? 'trailer-icon' : 'action-button secondary trailer-button'} onClick={() => setOpen(true)}><Play />{variant === 'button' && 'Watch Trailer'}</button>
    {open && <div className="trailer-backdrop" role="dialog" aria-modal="true" aria-label={`${title} trailer`} onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
      <div className="trailer-dialog"><header><span>{title}</span><button ref={closeRef} aria-label="Close trailer" onClick={() => setOpen(false)}><X /></button></header><div><iframe src={embedUrl} title={`${title} trailer`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen /></div></div>
    </div>}
  </>;
}
