'use client';

import Script from 'next/script';
import { useEffect } from 'react';

declare global {
  interface Window {
    adsbygoogle?: Array<Record<string, unknown>>;
    googlefc?: { callbackQueue?: unknown[]; showRevocationMessage?: () => void };
  }
}

export const ADSENSE_READY_EVENT = 'cineseya:adsense-ready';

export function AdSenseLoader({ enabled, publisherId, nonce }: { enabled: boolean; publisherId: string; nonce?: string }) {
  useEffect(() => {
    if (!enabled) return;
    const onViolation = (event: SecurityPolicyViolationEvent) => {
      if (/google|doubleclick/i.test(event.blockedURI)) sessionStorage.setItem('cineseya.ads.lastCspError', `${new Date().toISOString()} · ${event.effectiveDirective} · ${event.blockedURI}`);
    };
    window.addEventListener('securitypolicyviolation', onViolation);
    return () => window.removeEventListener('securitypolicyviolation', onViolation);
  }, [enabled]);

  if (!enabled) return null;
  return <Script
    id={`cineseya-adsense-${publisherId}`}
    nonce={nonce}
    strategy="lazyOnload"
    async
    crossOrigin="anonymous"
    src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(publisherId)}`}
    onReady={() => {
      window.adsbygoogle = window.adsbygoogle || [];
      window.dispatchEvent(new Event(ADSENSE_READY_EVENT));
      sessionStorage.removeItem('cineseya.ads.lastScriptError');
    }}
    onError={() => {
      sessionStorage.setItem('cineseya.ads.lastScriptError', new Date().toISOString());
      console.warn('CineSeya advertising script was blocked or failed to load. Core browsing remains available.');
    }}
  />;
}
