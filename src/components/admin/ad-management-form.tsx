'use client';

import { AlertTriangle, CheckCircle2, CircleOff, Plus, Save, Trash2 } from 'lucide-react';
import { useState, useSyncExternalStore, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AD_PLACEMENTS, AD_REVIEW_LABELS, type AdPageReview, type AdSettings } from '@/lib/ads';
import { readCsrfToken } from '@/lib/client/browser-brand';

type Diagnostic = { level: 'ok' | 'warning' | 'error' | 'info'; message: string };
const splitLines = (value: string) => value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
const subscribeBrowserDiagnostics = () => () => undefined;
const serverBrowserDiagnostic = () => 'Browser advertising diagnostics become available after hydration.';
const readBrowserDiagnostic = () => {
  const script = sessionStorage.getItem('cineseya.ads.lastScriptError');
  const csp = sessionStorage.getItem('cineseya.ads.lastCspError');
  return csp ? `Last advertising CSP error: ${csp}` : script ? `Last advertising script failure: ${script}` : 'No advertising script or CSP failure is recorded in this browser session.';
};

export function AdManagementForm({ initial, diagnostics, canUpdate }: { initial: AdSettings; diagnostics: Diagnostic[]; canUpdate: boolean }) {
  const router = useRouter();
  const [settings, setSettings] = useState(initial);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const browserDiagnostic = useSyncExternalStore(subscribeBrowserDiagnostics, readBrowserDiagnostic, serverBrowserDiagnostic);

  function updateReview(index: number, patch: Partial<AdPageReview>) {
    setSettings((current) => ({ ...current, reviews: current.reviews.map((review, itemIndex) => itemIndex === index ? { ...review, ...patch } : review) }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(''); setMessage('');
    let confirmLiveActivation = false;
    if (settings.mode === 'live' && settings.masterEnabled) {
      confirmLiveActivation = window.confirm('Start live ad requests only after you have verified the real AdSense Ready status, exact IDs, ads.txt, Auto ads OFF, rights reviews and a certified CMP. Continue?');
      if (!confirmLiveActivation) return;
    }
    setPending(true);
    try {
      const response = await fetch('/api/admin/settings/ads', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-csrf-token': readCsrfToken() },
        body: JSON.stringify({ ...settings, confirmLiveActivation }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || 'Advertising settings could not be saved.');
      setSettings(result.settings);
      setMessage(settings.mode === 'live' && settings.masterEnabled ? 'Configuration saved. Live requests remain subject to every page-level eligibility check.' : 'Advertising configuration saved safely.');
      router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Advertising settings could not be saved.'); }
    finally { setPending(false); }
  }

  return <form className="ad-admin" onSubmit={submit}>
    <header className="admin-page-head"><div><span>Controlled monetization</span><h1>Ad Management</h1><p>Manual responsive placements with fail-closed language, rights, consent and publication checks.</p></div>{canUpdate && <button className="admin-primary" disabled={pending}><Save/>{pending ? 'Saving…' : 'Save configuration'}</button>}</header>

    <section className="admin-panel ad-safety-panel"><div className="admin-panel-head"><div><h2>Global safety</h2><span>The master switch stops new ad requests; already-rendered ads in open tabs may remain temporarily.</span></div></div><div className="ad-admin-grid">
      <label><span>Global mode</span><select disabled={!canUpdate} value={settings.mode} onChange={(event) => setSettings({ ...settings, mode: event.target.value as AdSettings['mode'] })}><option value="disabled">Disabled</option><option value="mock">Mock preview</option><option value="live">Live</option></select></label>
      <label className="ad-check"><input disabled={!canUpdate} type="checkbox" checked={settings.masterEnabled} onChange={(event) => setSettings({ ...settings, masterEnabled: event.target.checked })}/><span>Master switch: allow new live ad requests</span></label>
      <label className="ad-check"><input disabled={!canUpdate} type="checkbox" checked={settings.siteApprovalConfirmed} onChange={(event) => setSettings({ ...settings, siteApprovalConfirmed: event.target.checked })}/><span>I checked the actual AdSense account and the site is Ready</span></label>
      <label className="ad-check"><input disabled={!canUpdate} type="checkbox" checked={settings.autoAdsConfirmedOff} onChange={(event) => setSettings({ ...settings, autoAdsConfirmedOff: event.target.checked })}/><span>I confirmed Auto ads are OFF in the AdSense dashboard</span></label>
      <label><span>Publisher ID</span><input disabled={!canUpdate} value={settings.publisherId} onChange={(event) => setSettings({ ...settings, publisherId: event.target.value.trim() })} placeholder="ca-pub-0000000000000000" autoComplete="off"/></label>
      <label><span>Approved production hostnames (one per line)</span><textarea disabled={!canUpdate} value={settings.productionHosts.join('\n')} onChange={(event) => setSettings({ ...settings, productionHosts: splitLines(event.target.value) })}/></label>
    </div></section>

    <section className="admin-panel"><div className="admin-panel-head"><div><h2>Manual placements</h2><span>Numeric unit IDs only. No custom JavaScript or HTML is accepted.</span></div></div><div className="ad-placement-admin-list">{AD_PLACEMENTS.map((placement) => {
      const value = settings.placements[placement];
      return <article key={placement}><header><b>{placement}</b><label className="ad-check"><input disabled={!canUpdate} type="checkbox" checked={value.enabled} onChange={(event) => setSettings({ ...settings, placements: { ...settings.placements, [placement]: { ...value, enabled: event.target.checked } } })}/><span>Enabled</span></label></header><label><span>Ad-unit ID</span><input disabled={!canUpdate} inputMode="numeric" value={value.unitId} onChange={(event) => setSettings({ ...settings, placements: { ...settings.placements, [placement]: { ...value, unitId: event.target.value.replace(/\D/g, '') } } })} placeholder="Numeric ID"/></label><div><label className="ad-check"><input disabled={!canUpdate} type="checkbox" checked={value.desktop} onChange={(event) => setSettings({ ...settings, placements: { ...settings.placements, [placement]: { ...value, desktop: event.target.checked } } })}/><span>Desktop</span></label><label className="ad-check"><input disabled={!canUpdate} type="checkbox" checked={value.mobile} onChange={(event) => setSettings({ ...settings, placements: { ...settings.placements, [placement]: { ...value, mobile: event.target.checked } } })}/><span>Mobile</span></label></div></article>;
    })}</div></section>

    <section className="admin-panel"><div className="admin-panel-head"><div><h2>Consent and ads.txt</h2><span>A local checkbox records configuration review; it does not fabricate consent, approval or legal rights.</span></div></div><div className="ad-admin-grid">
      <label><span>Certified CMP</span><select disabled={!canUpdate} value={settings.consent.provider} onChange={(event) => setSettings({ ...settings, consent: { ...settings.consent, provider: event.target.value as AdSettings['consent']['provider'] } })}><option value="none">Not configured</option><option value="google-privacy-messaging">Google Privacy & messaging</option><option value="certified-third-party">Third-party CMP (not integrated; blocks Live)</option></select></label>
      <label><span>CMP provider name</span><input disabled={!canUpdate} value={settings.consent.providerName} onChange={(event) => setSettings({ ...settings, consent: { ...settings.consent, providerName: event.target.value } })}/></label>
      <label className="ad-check"><input disabled={!canUpdate} type="checkbox" checked={settings.consent.configured} onChange={(event) => setSettings({ ...settings, consent: { ...settings.consent, configured: event.target.checked } })}/><span>Certified CMP has been configured and tested for applicable regions</span></label>
      <label className="ad-check"><input disabled={!canUpdate} type="checkbox" checked={settings.adsTxt.includeGoogleSeller} onChange={(event) => setSettings({ ...settings, adsTxt: { ...settings.adsTxt, includeGoogleSeller: event.target.checked } })}/><span>Publish the Google seller line derived from this publisher ID</span></label>
      <label className="span-2"><span>Other legitimate ads.txt entries (one record per line)</span><textarea disabled={!canUpdate} value={settings.adsTxt.additionalEntries.join('\n')} onChange={(event) => setSettings({ ...settings, adsTxt: { ...settings.adsTxt, additionalEntries: splitLines(event.target.value) } })}/></label>
      <label className="span-2"><span>Additional route exclusions (one local route per line; trailing * matches descendants)</span><textarea disabled={!canUpdate} value={settings.routeExclusions.join('\n')} onChange={(event) => setSettings({ ...settings, routeExclusions: splitLines(event.target.value) })}/></label>
    </div></section>

    <section className="admin-panel"><div className="admin-panel-head"><div><h2>Page eligibility reviews</h2><span>Review the publisher content language—not spoken audio, subtitle language or navigation language.</span></div>{canUpdate && <button type="button" className="admin-secondary" onClick={() => setSettings({ ...settings, reviews: [...settings.reviews, { route: '/', title: 'Homepage', primaryLanguage: 'en', state: 'not_reviewed', originalContent: false, rightsReviewed: false, excluded: false, notes: '' }] })}><Plus/>Add review</button>}</div><div className="ad-review-list">{settings.reviews.length ? settings.reviews.map((review, index) => <article key={`${review.route}-${index}`}>
      <div className="ad-review-fields"><label><span>Exact public route</span><input disabled={!canUpdate} value={review.route} onChange={(event) => updateReview(index, { route: event.target.value })}/></label><label><span>Page title</span><input disabled={!canUpdate} value={review.title} onChange={(event) => updateReview(index, { title: event.target.value })}/></label><label><span>Primary publisher-content language code</span><input disabled={!canUpdate} value={review.primaryLanguage} onChange={(event) => updateReview(index, { primaryLanguage: event.target.value.toLowerCase() })} placeholder="en"/></label><label><span>Editorial state</span><select disabled={!canUpdate} value={review.state} onChange={(event) => updateReview(index, { state: event.target.value as AdPageReview['state'] })}>{Object.entries(AD_REVIEW_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label className="span-2"><span>Internal review notes</span><textarea disabled={!canUpdate} value={review.notes} onChange={(event) => updateReview(index, { notes: event.target.value })}/></label></div>
      <div className="ad-review-checks"><label className="ad-check"><input disabled={!canUpdate} type="checkbox" checked={review.originalContent} onChange={(event) => updateReview(index, { originalContent: event.target.checked })}/><span>Substantial original content confirmed</span></label><label className="ad-check"><input disabled={!canUpdate} type="checkbox" checked={review.rightsReviewed} onChange={(event) => updateReview(index, { rightsReviewed: event.target.checked })}/><span>Content and rights review complete</span></label><label className="ad-check"><input disabled={!canUpdate} type="checkbox" checked={review.excluded} onChange={(event) => updateReview(index, { excluded: event.target.checked })}/><span>Exclude this page</span></label>{canUpdate && <button type="button" className="admin-danger" onClick={() => setSettings({ ...settings, reviews: settings.reviews.filter((_, itemIndex) => itemIndex !== index) })}><Trash2/>Remove</button>}</div>
    </article>) : <p className="admin-empty"><CircleOff/>No page has been editorially reviewed, so live eligibility fails closed.</p>}</div></section>

    <section className="admin-panel ad-diagnostics"><div className="admin-panel-head"><div><h2>Diagnostics</h2><span>Configuration status only—no fabricated revenue, impressions, fill rate or approval data.</span></div></div><div>{diagnostics.map((item, index) => <p className={`diagnostic-${item.level}`} key={`${item.message}-${index}`}>{item.level === 'ok' ? <CheckCircle2/> : <AlertTriangle/>}{item.message}</p>)}<p className="diagnostic-info"><AlertTriangle/>{browserDiagnostic}</p></div>{settings.lastChangedAt && <footer>Last changed by <b>{settings.lastChangedBy || 'unknown administrator'}</b> on {new Date(settings.lastChangedAt).toLocaleString('en-LK')}.</footer>}</section>
    {error && <p className="admin-form-error" role="alert">{error}</p>}{message && <p className="admin-form-success" role="status"><CheckCircle2/>{message}</p>}
  </form>;
}
