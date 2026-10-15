'use client';

import { useEffect, useRef, useState } from 'react';
import type { AdPlacement, AdRenderDecision } from '@/lib/ads';
import { ADSENSE_READY_EVENT } from './ad-sense-loader';

function useViewportEnabled(desktop: boolean, mobile: boolean, desktopBreakpoint: number) {
  const [enabled, setEnabled] = useState(desktop && mobile);
  useEffect(() => {
    const query = window.matchMedia(`(min-width: ${desktopBreakpoint}px)`);
    const update = () => setEnabled(query.matches ? desktop : mobile);
    update(); query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, [desktop, mobile, desktopBreakpoint]);
  return enabled;
}

export function AdPreview({ placement }: { placement: AdPlacement }) {
  return <div className="ad-preview" aria-label={`Mock preview for ${placement}`}>
    <strong>Ad preview — no live advertisement</strong>
    <span>{placement.replaceAll('_', ' ')}</span>
  </div>;
}

export function AdSlot({ placement, decision, format = 'auto', desktopBreakpoint = 768 }: { placement: AdPlacement; decision: AdRenderDecision; format?: 'auto' | 'horizontal' | 'rectangle' | 'vertical'; desktopBreakpoint?: number }) {
  const viewportEnabled = useViewportEnabled(decision.desktop, decision.mobile, desktopBreakpoint);
  const element = useRef<HTMLModElement>(null);
  const visible = useRef(false);

  useEffect(() => {
    if (decision.render !== 'live' || !viewportEnabled) return;
    const node = element.current;
    if (!node) return;
    const initialize = () => {
      if (!visible.current || node.dataset.cineseyaInitialized === 'true' || node.getBoundingClientRect().width <= 0 || !window.adsbygoogle) return;
      try {
        node.dataset.cineseyaInitialized = 'true';
        window.adsbygoogle.push({});
      } catch (error) {
        delete node.dataset.cineseyaInitialized;
        console.warn('CineSeya ad unit could not initialize.', error);
      }
    };
    const observer = new IntersectionObserver((entries) => {
      visible.current = entries.some((entry) => entry.isIntersecting);
      if (visible.current) initialize();
    }, { rootMargin: '320px 0px' });
    observer.observe(node);
    window.addEventListener(ADSENSE_READY_EVENT, initialize);
    initialize();
    return () => { observer.disconnect(); window.removeEventListener(ADSENSE_READY_EVENT, initialize); };
  }, [decision.render, viewportEnabled]);

  if (decision.render === 'none' || !viewportEnabled) return null;
  return <aside className={`ad-placement ad-placement-${placement.toLowerCase().replaceAll('_', '-')}`} aria-label="Advertisements">
    <span className="ad-label">Advertisements</span>
    {decision.render === 'mock' ? <AdPreview placement={placement}/> : <ins
      ref={element}
      className="adsbygoogle"
      data-ad-client={decision.publisherId}
      data-ad-slot={decision.unitId}
      data-ad-format={format}
      data-full-width-responsive={format === 'auto' ? 'true' : 'false'}
    />}
  </aside>;
}
