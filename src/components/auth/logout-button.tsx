'use client';

import { LogOut } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { readCsrfToken } from '@/lib/client/browser-brand';

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return <button className="logout-button" disabled={pending} onClick={async () => {
    setPending(true);
    const response = await fetch('/api/auth/logout', { method: 'POST', headers: { 'x-csrf-token': readCsrfToken() } });
    if (response.ok) { router.push('/'); router.refresh(); } else setPending(false);
  }}><LogOut/>{pending ? 'Signing out…' : 'Sign out'}</button>;
}
