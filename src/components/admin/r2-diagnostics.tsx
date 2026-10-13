'use client';

import { CheckCircle2, CloudCog, LoaderCircle, XCircle } from 'lucide-react';
import { useState } from 'react';
import { readCsrfToken } from '@/lib/client/browser-brand';
import { uploadApiFetch as fetch } from '@/lib/client/upload-json';

type DiagnosticResult = {
  bucket: 'assets' | 'media';
  label: string;
  connected: boolean;
  write: boolean;
  read: boolean;
  delete: boolean;
  error?: string;
};

const csrf = readCsrfToken;

function Check({ label, passed }: { label: string; passed: boolean }) {
  return <span className={passed ? 'passed' : 'failed'}>{passed ? <CheckCircle2/> : <XCircle/>}{label}</span>;
}

export function R2Diagnostics() {
  const [pending, setPending] = useState(false);
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const [error, setError] = useState('');

  async function run() {
    setPending(true);
    setError('');
    setResults([]);
    try {
      const response = await fetch('/api/admin/storage/diagnostics', { method: 'POST', headers: { 'x-csrf-token': csrf() } });
      const data = await response.json() as { results?: DiagnosticResult[]; error?: { message?: string } };
      if (!response.ok) throw new Error(data.error?.message || 'R2 diagnostics could not run.');
      setResults(data.results || []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'R2 diagnostics could not run.');
    } finally {
      setPending(false);
    }
  }

  return <section className="r2-diagnostics">
    <header><CloudCog/><div><h2>Cloudflare R2 diagnostics</h2><p>Writes, verifies, reads, and deletes one tiny temporary object in each private bucket.</p></div><button className="admin-primary" type="button" onClick={run} disabled={pending}>{pending ? <LoaderCircle className="spin"/> : <CloudCog/>}{pending ? 'Testing R2' : 'Cloudflare R2 Diagnostics'}</button></header>
    {results.length > 0 && <div className="r2-diagnostic-grid">{results.map((result) => <article key={result.bucket}><h3>{result.label}</h3><Check label="Connected" passed={result.connected}/><Check label="Write" passed={result.write}/><Check label="Read" passed={result.read}/><Check label="Delete" passed={result.delete}/>{result.error && <small>{result.error}</small>}</article>)}</div>}
    {error && <p className="admin-form-error">{error}</p>}
  </section>;
}
