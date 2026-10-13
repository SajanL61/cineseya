'use client';

import { Check, Copy, Facebook, MessageCircle, Send, Share2, Smartphone, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { buildShareTargets } from '@/lib/share';

type ShareEvent = 'whatsapp_share' | 'facebook_share' | 'telegram_share' | 'copy_link';

export function ShareButton({ title, canonicalUrl, contentType = 'page', contentId }: { title: string; canonicalUrl?: string; contentType?: 'movie' | 'series' | 'episode' | 'subtitle' | 'page'; contentId?: string }) {
  const [open, setOpen] = useState(false); const [copied, setCopied] = useState(false); const closeButton = useRef<HTMLButtonElement>(null);
  const url = canonicalUrl || (typeof window === 'undefined' ? '' : `${window.location.origin}${window.location.pathname}`);
  const message = `${title} — CineSeya.lk`;
  const targets = buildShareTargets(title, url);
  useEffect(() => { if (!open) return; closeButton.current?.focus(); const key = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); }; window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key); }, [open]);

  function track(eventType: ShareEvent) {
    if (!url) return;
    const path = new URL(url, window.location.origin).pathname;
    void fetch('/api/analytics/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true, body: JSON.stringify({ eventType, contentType, contentId, path }) }).catch(() => undefined);
  }
  async function copy() { await navigator.clipboard.writeText(url); track('copy_link'); setCopied(true); window.setTimeout(() => setCopied(false), 1_800); }
  async function deviceShare() { if (navigator.share) await navigator.share({ title, text: message, url }); }
  const links = [
    { label: 'WhatsApp', icon: MessageCircle, event: 'whatsapp_share' as const, href: targets.whatsapp },
    { label: 'Facebook', icon: Facebook, event: 'facebook_share' as const, href: targets.facebook },
    { label: 'Telegram', icon: Send, event: 'telegram_share' as const, href: targets.telegram },
  ];
  const dialog = open ? <div className="share-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}><section className="share-dialog" role="dialog" aria-modal="true" aria-labelledby="share-title"><header><div><small>Share CineSeya</small><h2 id="share-title">{title}</h2></div><button ref={closeButton} type="button" aria-label="Close share options" onClick={() => setOpen(false)}><X/></button></header><div className="share-grid">{links.map(({ label, icon: Icon, href, event }) => <a href={href} target="_blank" rel="noopener noreferrer" onClick={() => track(event)} key={label}><Icon/><span>{label}</span></a>)}<button type="button" onClick={() => void copy()}>{copied ? <Check/> : <Copy/>}<span>{copied ? 'Copied' : 'Copy Link'}</span></button>{typeof navigator !== 'undefined' && 'share' in navigator && <button type="button" onClick={() => void deviceShare()}><Smartphone/><span>Share via device</span></button>}</div><p>Only this public page is shared. Secure download tokens and private file URLs are never included.</p></section></div> : null;
  return <><button className="detail-secondary-action" type="button" onClick={() => setOpen(true)}><Share2/>Share</button>{dialog ? createPortal(dialog, document.body) : null}</>;
}
