'use client';

import { Eye, EyeOff, KeyRound, LoaderCircle, LockKeyhole } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { readCsrfToken } from '@/lib/client/browser-brand';

function responseMessage(result: { error?: { message?: string; fields?: Record<string, string[]> } }) {
  const fieldMessage = result.error?.fields && Object.values(result.error.fields).flat().find(Boolean);
  return fieldMessage || result.error?.message || 'The password could not be changed.';
}

export function ChangePasswordForm() {
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setPending(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/auth/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': readCsrfToken() },
        body: JSON.stringify({
          currentPassword: String(form.get('currentPassword') || ''),
          newPassword: String(form.get('newPassword') || ''),
          confirmPassword: String(form.get('confirmPassword') || ''),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(responseMessage(result));
      formElement.reset();
      setVisible(false);
      setMessage(result.message || 'Password changed successfully.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The password could not be changed.');
    } finally {
      setPending(false);
    }
  }

  const passwordType = visible ? 'text' : 'password';
  return <section className="password-change" id="password-security">
    <header><KeyRound/><div><h2>Change password</h2><p>Confirm your current password before choosing a new one.</p></div></header>
    <form className="password-change-form" onSubmit={submit}>
      <label className="password-current" htmlFor="currentPassword">Current password<span className="password-change-field"><LockKeyhole/><input id="currentPassword" name="currentPassword" type={passwordType} autoComplete="current-password" maxLength={256} required/><button type="button" aria-label={visible ? 'Hide passwords' : 'Show passwords'} onClick={() => setVisible((value) => !value)}>{visible ? <EyeOff/> : <Eye/>}</button></span></label>
      <label htmlFor="newPassword">New password<span className="password-change-field"><LockKeyhole/><input id="newPassword" name="newPassword" type={passwordType} autoComplete="new-password" minLength={10} maxLength={256} required/></span></label>
      <label htmlFor="confirmPassword">Confirm new password<span className="password-change-field"><LockKeyhole/><input id="confirmPassword" name="confirmPassword" type={passwordType} autoComplete="new-password" minLength={10} maxLength={256} required/></span></label>
      <p className="password-change-hint">Use at least 10 characters with uppercase, lowercase, and a number.</p>
      {error && <p className="password-change-error" role="alert">{error}</p>}
      {message && <p className="password-change-success" role="status">{message}</p>}
      <button className="action-button" type="submit" disabled={pending}>{pending ? <LoaderCircle className="spin"/> : <KeyRound/>}{pending ? 'Changing password' : 'Change password'}</button>
    </form>
  </section>;
}
