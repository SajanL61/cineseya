'use client';

import { useState } from 'react';

export function PrivacyChoicesButton({ enabled }: { enabled: boolean }) {
  const [message, setMessage] = useState('');
  if (!enabled) return null;
  const openChoices = () => {
    window.googlefc = window.googlefc || {};
    window.googlefc.callbackQueue = window.googlefc.callbackQueue || [];
    if (window.googlefc.showRevocationMessage) window.googlefc.showRevocationMessage();
    else {
      window.googlefc.callbackQueue.push({ CONSENT_API_READY: () => window.googlefc?.showRevocationMessage?.() });
      setMessage('Privacy controls will open when the certified consent service is ready.');
    }
  };
  return <><button type="button" className="privacy-choices" onClick={openChoices}>Privacy and cookie settings</button>{message && <span className="sr-only" role="status">{message}</span>}</>;
}
