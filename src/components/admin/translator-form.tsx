'use client';

import { CheckCircle2, Copy, LoaderCircle, Save, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { InlineAssetUpload } from '@/components/admin/inline-asset-upload';
import { readCsrfToken } from '@/lib/client/browser-brand';
import type { TranslatorUserOption } from '@/services/admin-translators';

export type TranslatorFormInitial = {
  id: string;
  displayName: string;
  slug: string;
  bio: string;
  avatarUrl: string;
  userId: string;
  verified: boolean;
  totalSubtitles: number;
  totalDownloads: number;
};

type Props = {
  initial?: TranslatorFormInitial;
  canVerify: boolean;
  canManageUserLink: boolean;
  canUploadAvatar: boolean;
  userOptions: TranslatorUserOption[];
};

const slugify = (value: string) => value
  .normalize('NFKD')
  .toLocaleLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 120);

export function TranslatorForm({ initial, canVerify, canManageUserLink, canUploadAvatar, userOptions }: Props) {
  const router = useRouter();
  const [values, setValues] = useState({
    displayName: initial?.displayName ?? '',
    slug: initial?.slug ?? '',
    bio: initial?.bio ?? '',
    avatarUrl: initial?.avatarUrl ?? '',
    userId: initial?.userId ?? '',
    verified: initial?.verified ?? false,
  });
  const [slugEdited, setSlugEdited] = useState(Boolean(initial));
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);
  const editing = Boolean(initial);

  function update<K extends keyof typeof values>(key: K, value: (typeof values)[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function updateName(displayName: string) {
    setValues((current) => ({ ...current, displayName, ...(!slugEdited ? { slug: slugify(displayName) } : {}) }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setDone(false);
    setMessage(editing ? 'Saving translator profile…' : 'Creating translator profile…');
    try {
      const response = await fetch(editing ? `/api/admin/translators/${initial!.id}` : '/api/admin/translators', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': readCsrfToken() },
        body: JSON.stringify({
          displayName: values.displayName,
          slug: values.slug,
          bio: values.bio,
          avatarUrl: values.avatarUrl,
          userId: canManageUserLink ? values.userId || null : initial?.userId || null,
          verified: canVerify ? values.verified : initial?.verified ?? false,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error?.message || 'Translator profile could not be saved.');
      setDone(true);
      setMessage(editing ? 'Translator profile saved.' : 'Translator profile created.');
      router.push('/admin/translators');
      router.refresh();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Translator profile could not be saved.');
    } finally {
      setPending(false);
    }
  }

  async function copyId() {
    if (!initial) return;
    try {
      await navigator.clipboard.writeText(initial.id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_800);
    } catch {
      setMessage('The profile ID could not be copied.');
    }
  }

  return <form className="admin-editor translator-editor" onSubmit={submit}>
    {initial && <div className="translator-id-bar"><span><small>Translator profile ID</small><code>{initial.id}</code></span><button type="button" onClick={() => void copyId()}><Copy/>{copied ? 'Copied' : 'Copy ID'}</button><span className="translator-form-stats">{initial.totalSubtitles} subtitles · {initial.totalDownloads.toLocaleString()} downloads</span></div>}
    <details open>
      <summary><span>1</span>Profile details<UserRound/></summary>
      <div className="admin-form-grid">
        <label>Display name<input value={values.displayName} onChange={(event) => updateName(event.target.value)} minLength={2} maxLength={120} required disabled={pending}/></label>
        <label>Public slug<input value={values.slug} onChange={(event) => { setSlugEdited(true); update('slug', event.target.value.toLocaleLowerCase()); }} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" minLength={2} maxLength={120} required disabled={pending}/><small>Public page: /translator/{values.slug || 'translator-name'}</small></label>
        <label className="span-2">Biography<textarea value={values.bio} onChange={(event) => update('bio', event.target.value)} maxLength={2000} rows={7} disabled={pending}/><small>{values.bio.length}/2000 characters</small></label>
        <label className="span-2">Avatar URL or R2 object key<input value={values.avatarUrl} onChange={(event) => update('avatarUrl', event.target.value)} maxLength={2000} placeholder="people/translators/name/avatar.webp" disabled={pending}/></label>
        {canUploadAvatar && <div className="span-2"><InlineAssetUpload kind="avatar" linkedModel="TranslatorProfile" linkedId={initial?.id} onUploaded={(asset) => update('avatarUrl', asset.objectKey)}/></div>}
        {canManageUserLink && <label className="span-2">Linked user account<select value={values.userId} onChange={(event) => update('userId', event.target.value)} disabled={pending}><option value="">No linked login account</option>{userOptions.map((user) => <option key={user.id} value={user.id}>{user.label} · {user.email} ({user.role.replaceAll('_', ' ')})</option>)}</select><small>Linking an account lets a translator-role user submit subtitles as this profile.</small></label>}
        <div className="admin-checks span-2">
          {canVerify ? <label><input type="checkbox" checked={values.verified} onChange={(event) => update('verified', event.target.checked)} disabled={pending}/> Verified translator</label> : <span className="translator-verification-note">Verification can only be changed by a subtitle verifier.</span>}
        </div>
      </div>
    </details>
    {message && <p className={done ? 'admin-success' : pending ? 'upload-progress' : 'admin-form-error'}>{done ? <CheckCircle2/> : pending ? <LoaderCircle className="spin"/> : null}{message}</p>}
    <div className="translator-form-actions"><Link href="/admin/translators">Cancel</Link><button className="admin-primary" disabled={pending}>{pending ? <LoaderCircle className="spin"/> : <Save/>}{pending ? 'Saving…' : editing ? 'Save changes' : 'Create translator'}</button></div>
  </form>;
}
