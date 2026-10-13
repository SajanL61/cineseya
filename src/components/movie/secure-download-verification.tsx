'use client';

import Script from 'next/script';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Download, LoaderCircle, LockKeyhole, RefreshCw, Server, ShieldCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { DownloadMirrorDto } from '@/types/media';

declare global {
  interface Window {
    turnstile?: { render: (element: HTMLElement, options: { sitekey: string; callback: (token: string) => void; 'expired-callback': () => void; 'error-callback': () => void; theme: 'dark' }) => string; reset: (widgetId: string) => void };
  }
}

type Step = 0 | 1 | 2 | 3;
type ApiError = { error?: { message?: string } };

async function post<T>(url: string, body: Record<string, unknown>) {
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store', body: JSON.stringify(body) });
  const result = await response.json() as T & ApiError;
  if (!response.ok) throw new Error(result.error?.message || 'The verification request could not be completed.');
  return result;
}

export function SecureDownloadVerification({ mediaVersionId, directAvailable, mirrors }: { mediaVersionId: string; directAvailable: boolean; mirrors: DownloadMirrorDto[] }) {
  const mirrorId = useSearchParams().get('server') || undefined;
  const mirror = mirrorId ? mirrors.find((item) => item.id === mirrorId) : undefined;
  const serverName = mirror?.label || mirror?.providerName || 'CineSeya Direct';
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const [completed, setCompleted] = useState<Step>(0);
  const [pending, setPending] = useState<Step | null>(null);
  const [sessionToken, setSessionToken] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileReady, setTurnstileReady] = useState(false);
  const [next, setNext] = useState('');
  const [error, setError] = useState(!mirrorId && !directAvailable ? 'CineSeya Direct is unavailable. Return to the title and choose an active mirror.' : mirrorId && !mirror ? 'The selected mirror is unavailable.' : '');
  const challenge = useRef<HTMLDivElement>(null);
  const widgetId = useRef('');

  useEffect(() => {
    if (!siteKey || !turnstileReady || !challenge.current || !window.turnstile || widgetId.current) return;
    widgetId.current = window.turnstile.render(challenge.current, {
      sitekey: siteKey, theme: 'dark', callback: setTurnstileToken,
      'expired-callback': () => setTurnstileToken(''), 'error-callback': () => setTurnstileToken(''),
    });
  }, [turnstileReady, siteKey]);

  async function runStep(step: Step) {
    setPending(step); setError('');
    try {
      if (step === 1) {
        const result = await post<{ sessionToken: string }>('/api/download/verify/file', { mediaVersionId, mirrorId });
        setSessionToken(result.sessionToken); setCompleted(1);
      } else if (step === 2) {
        await post('/api/download/verify/security', { sessionToken, turnstileToken: turnstileToken || undefined }); setCompleted(2);
      } else if (step === 3) {
        const result = await post<{ next: string }>('/api/download/verify/generate', { sessionToken }); setNext(result.next); setCompleted(3);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Verification failed. Please try again.');
      if (step === 2 && widgetId.current) { window.turnstile?.reset(widgetId.current); setTurnstileToken(''); }
    } finally { setPending(null); }
  }

  const steps = [
    { number: 1 as Step, icon: Server, title: 'File & Server Verification', text: `Confirm the media record, file size, rights and ${serverName} availability.`, action: 'Verify File' },
    { number: 2 as Step, icon: ShieldCheck, title: 'Security Verification', text: 'Confirm the session, request origin, rate limit and security challenge.', action: 'Verify Security' },
    { number: 3 as Step, icon: LockKeyhole, title: 'Secure Download Generation', text: 'Run a fresh rights check and prepare an opaque, short-lived access link.', action: 'Generate Secure Link' },
  ];

  return <div className="download-preparation">
    {siteKey && <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onLoad={() => setTurnstileReady(true)}/>}
    <div className="download-security-status"><ShieldCheck/><span><b>CineSeya secure verification</b><small>Real server checks · 10-minute session · no advertising gates</small></span></div>
    <div className="verification-steps">{steps.map(({ number, icon: Icon, title, text, action }) => {
      const verified = completed >= number; const unlocked = number === 1 || completed >= number - 1;
      return <section className={`verification-step ${verified ? 'verified' : unlocked ? 'active' : 'locked'}`} key={number}>
        <header><span><Icon/><b>Step {number}</b></span><em>{verified ? <><CheckCircle2/>Verified</> : unlocked ? 'Active' : <><LockKeyhole/>Locked</>}</em></header>
        <h2>{title}</h2><p>{text}</p>
        {number === 2 && unlocked && !verified && siteKey && <div className="turnstile-slot" ref={challenge}/>}
        {!verified && <button type="button" disabled={!unlocked || pending !== null || Boolean(error) || (number === 2 && Boolean(siteKey) && !turnstileToken)} onClick={() => void runStep(number)}>{pending === number ? <LoaderCircle className="spin"/> : <Icon/>}{pending === number ? 'Checking…' : action}</button>}
      </section>;
    })}</div>
    {error && <div className="download-prepare-error"><p>{error}</p><button type="button" onClick={() => { setError(''); setCompleted(0); setSessionToken(''); setNext(''); }}><RefreshCw/>Try again</button></div>}
    {completed === 3 && next && <a className="download-start" href={next}><Download/>Download Now</a>}
    <p className="download-trust"><CheckCircle2/>Verification never asks you to open unrelated sites or click advertisements.</p>
  </div>;
}
