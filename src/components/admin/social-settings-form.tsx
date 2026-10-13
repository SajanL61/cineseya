'use client';

import { CheckCircle2, Save } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { readCsrfToken } from '@/lib/client/browser-brand';
import type { SocialSettings } from '@/services/site-settings';

const fields = [{ key: 'facebook', label: 'Facebook Page URL' }, { key: 'telegram', label: 'Telegram Channel URL' }, { key: 'whatsapp', label: 'WhatsApp Community URL' }, { key: 'instagram', label: 'Instagram URL' }, { key: 'youtube', label: 'YouTube URL' }, { key: 'tiktok', label: 'TikTok URL' }, { key: 'x', label: 'X / Twitter URL' }, { key: 'website', label: 'Website URL' }] as const;
const csrf = readCsrfToken;

export function SocialSettingsForm({ initial, canUpdate }: { initial: SocialSettings; canUpdate: boolean }) {
  const [pending, setPending] = useState(false); const [message, setMessage] = useState(''); const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setPending(true); setMessage(''); setError(''); const form = new FormData(event.currentTarget); const body = Object.fromEntries(fields.map(({ key }) => [key, String(form.get(key) || '').trim()])); try { const response = await fetch('/api/admin/settings/social', { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf() }, body: JSON.stringify(body) }); const result = await response.json(); if (!response.ok) throw new Error(result.error?.message || 'Settings could not be saved.'); setMessage('Social and community links saved.'); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Settings could not be saved.'); } finally { setPending(false); } }
  return <section className="admin-panel social-settings-panel"><div className="admin-panel-head"><div><h2>Social & Community</h2><span>Footer and community destinations</span></div></div><form onSubmit={submit}>{fields.map(({ key, label }) => <label key={key}><span>{label}</span><input name={key} type="url" defaultValue={initial[key] || ''} placeholder="https://…" required={key === 'website'} disabled={!canUpdate}/></label>)}{canUpdate && <button className="admin-primary" disabled={pending}><Save/>{pending ? 'Saving…' : 'Save settings'}</button>}{message && <p className="admin-form-success"><CheckCircle2/>{message}</p>}{error && <p className="admin-form-error">{error}</p>}</form></section>;
}
