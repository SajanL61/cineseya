'use client';

import { LoaderCircle, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { readCsrfToken } from '@/lib/client/browser-brand';
import { ROLES } from '@/types/auth';

const statusOptions: Record<string, string[]> = {
  comments: ['visible', 'hidden', 'deleted'],
  reports: ['new', 'reviewing', 'resolved', 'rejected'],
  takedowns: ['new', 'reviewing', 'resolved', 'rejected'],
  messages: ['new', 'reviewing', 'resolved'],
};

const csrf = readCsrfToken;

type Props = {
  resource: string;
  id: string;
  currentStatus?: string;
  currentRole?: string;
  active?: boolean;
  canUpdate: boolean;
  canChangeRole?: boolean;
};

export function AdminRecordActions({ resource, id, currentStatus, currentRole, active = true, canUpdate, canChangeRole = false }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus ?? '');
  const [role, setRole] = useState(currentRole ?? 'user');
  const [enabled, setEnabled] = useState(active);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  if (!canUpdate && !canChangeRole) return null;

  async function save() {
    setPending(true); setError('');
    const userResource = resource === 'users';
    const response = await fetch(userResource ? `/api/admin/users/${id}` : `/api/admin/moderation/${resource}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf() },
      body: JSON.stringify(userResource ? { ...(canChangeRole ? { role } : {}), active: enabled } : { status }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) setError(result.error?.message || 'Update failed.');
    else router.refresh();
    setPending(false);
  }

  if (resource === 'users') return <div className="admin-inline-actions">
    {canChangeRole && <label><span>Role</span><select value={role} onChange={(event) => setRole(event.target.value)}>{ROLES.map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select></label>}
    {canUpdate && <label className="admin-inline-check"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /> Active</label>}
    <button type="button" onClick={save} disabled={pending} aria-label="Save user access">{pending ? <LoaderCircle className="spin" /> : <Save />}</button>{error && <small role="alert">{error}</small>}
  </div>;

  const options = statusOptions[resource];
  if (!options) return null;
  return <div className="admin-inline-actions"><label><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value)}>{options.map((value) => <option key={value} value={value}>{value}</option>)}</select></label><button type="button" onClick={save} disabled={pending} aria-label="Save moderation status">{pending ? <LoaderCircle className="spin" /> : <Save />}</button>{error && <small role="alert">{error}</small>}</div>;
}
