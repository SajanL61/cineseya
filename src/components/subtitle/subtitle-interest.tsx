'use client';

import { Bell, BellRing, LoaderCircle, UsersRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { readCsrfToken } from '@/lib/client/browser-brand';

type InterestState = { hasPublished: boolean; requestCount: number; subscribed: boolean; requested: boolean };
const csrf = readCsrfToken;

export function SubtitleInterest({ contentType, contentId, title, authenticated, initial }: {
  contentType: 'movie' | 'episode'; contentId: string; title: string; authenticated: boolean; initial: InterestState;
}) {
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [pending, setPending] = useState<'subscribe' | 'request' | null>(null);
  const [message, setMessage] = useState('');
  if (state.hasPublished) return null;

  async function mutate(action: 'subscribe' | 'request') {
    if (!authenticated) {
      router.push(`/login?returnTo=${encodeURIComponent(`${window.location.pathname}#subtitles`)}`);
      return;
    }
    setPending(action); setMessage('');
    const removing = action === 'subscribe' && state.subscribed;
    try {
      const response = await fetch(`/api/subtitle-interest/${contentType}/${contentId}`, {
        method: removing ? 'DELETE' : 'POST', headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf() }, body: JSON.stringify({ action }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || 'Your subtitle preference could not be saved.');
      setState(result);
      setMessage(action === 'request' ? 'Request recorded. We will notify you if a Sinhala subtitle is published.' : removing ? 'Subtitle alert removed.' : 'You will be notified when the Sinhala subtitle is ready.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Your subtitle preference could not be saved.'); }
    finally { setPending(null); }
  }

  return <aside className="subtitle-interest" aria-label={`Sinhala subtitle updates for ${title}`}>
    <div><span><BellRing aria-hidden="true"/></span><div><b>Sinhala subtitle pending</b><p>Get an in-app alert as soon as a verified release is published.</p></div></div>
    <div className="subtitle-interest-count"><UsersRound aria-hidden="true"/><strong>{state.requestCount.toLocaleString()}</strong> {state.requestCount === 1 ? 'person has' : 'people have'} requested this subtitle</div>
    <div className="subtitle-interest-actions">
      <button type="button" className={state.subscribed ? 'active' : ''} disabled={Boolean(pending)} aria-pressed={state.subscribed} onClick={() => void mutate('subscribe')}>{pending === 'subscribe' ? <LoaderCircle className="spin"/> : state.subscribed ? <BellRing/> : <Bell/>}{state.subscribed ? 'Notifications On' : 'Notify Me'}</button>
      <button type="button" disabled={Boolean(pending) || state.requested} aria-pressed={state.requested} onClick={() => void mutate('request')}>{pending === 'request' ? <LoaderCircle className="spin"/> : <UsersRound/>}{state.requested ? 'Subtitle Requested' : 'Request Sinhala Subtitle'}</button>
    </div>
    {message && <p className="subtitle-interest-message" role="status" aria-live="polite">{message}</p>}
  </aside>;
}
