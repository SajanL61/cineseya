'use client';

import { CheckCircle2, LoaderCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { readCsrfToken } from '@/lib/client/browser-brand';
import { subtitlePublishConfirmation, subtitlePublishRequest } from '@/lib/client/subtitle-publishing';

type Props = {
  subtitleId: string;
  fileName: string;
  language: string;
  contentTitle: string;
  contentType: 'movie' | 'episode';
  status: string;
  canPublish: boolean;
};

export function SubtitlePublishAction({ subtitleId, fileName, language, contentTitle, contentType, status, canPublish }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [published, setPublished] = useState(status === 'published');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function publish() {
    const confirmed = window.confirm(subtitlePublishConfirmation({ fileName, language, contentTitle, contentType }));
    if (!confirmed) return;

    setPending(true);
    setMessage('');
    setError('');
    try {
      const request = subtitlePublishRequest(subtitleId, readCsrfToken());
      const response = await fetch(request.url, request.init);
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error?.message || 'Subtitle could not be published.');
      setPublished(true);
      setMessage('Subtitle published successfully.');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Subtitle could not be published.');
    } finally {
      setPending(false);
    }
  }

  if (published) return <div className="subtitle-publish-action"><span className="subtitle-published"><CheckCircle2 />Published</span>{message && <small role="status">{message}</small>}</div>;
  if (status !== 'draft' || !canPublish) return <span className="subtitle-no-action">—</span>;

  return <div className="subtitle-publish-action">
    <button type="button" onClick={publish} disabled={pending}>{pending ? <LoaderCircle className="spin" /> : <CheckCircle2 />}{pending ? 'Publishing…' : 'Publish'}</button>
    {error && <small className="subtitle-publish-error" role="alert">{error}</small>}
  </div>;
}
