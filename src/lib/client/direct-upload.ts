'use client';

import { uploadApiFetch as fetch } from './upload-json';
import { readCsrfToken } from './browser-brand';

export type CompletedUploadAsset = {
  id: string;
  objectKey: string;
  bucket: string;
  kind: string;
  fileName: string;
  size: number;
  status: string;
  publicUrl?: string;
};

type UploadTicket = { assetId: string; uploadUrl: string; headers: Record<string, string> };

const csrf = readCsrfToken;
export const uploadMimeType = (file: File) => file.type || ({ mkv: 'video/x-matroska', m3u8: 'application/vnd.apple.mpegurl' }[file.name.split('.').pop()?.toLocaleLowerCase() || ''] || 'application/octet-stream');

function put(url: string, file: File, headers: Record<string, string>, signal: AbortSignal, onProgress: (loaded: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('PUT', url);
    for (const [key, value] of Object.entries(headers)) request.setRequestHeader(key, value);
    request.upload.onprogress = (event) => onProgress(event.loaded);
    request.onerror = () => reject(new Error('R2 rejected the upload. Check the bucket CORS policy and signed request.'));
    request.onload = () => request.status >= 200 && request.status < 300 ? resolve() : reject(new Error(`R2 rejected the upload (${request.status}).`));
    const abort = () => { request.abort(); reject(new DOMException('Upload cancelled.', 'AbortError')); };
    signal.addEventListener('abort', abort, { once: true });
    request.onloadend = () => signal.removeEventListener('abort', abort);
    request.send(file);
  });
}

export async function uploadDirectAsset(input: {
  kind: 'poster' | 'backdrop' | 'avatar' | 'other';
  file: File;
  signal: AbortSignal;
  linkedModel?: string;
  linkedId?: string;
  onProgress?: (loaded: number, total: number) => void;
}) {
  const headers = { 'Content-Type': 'application/json', 'x-csrf-token': csrf() };
  const response = await fetch('/api/admin/uploads/presign', {
    method: 'POST', headers, signal: input.signal,
    body: JSON.stringify({ kind: input.kind, fileName: input.file.name, contentType: uploadMimeType(input.file), size: input.file.size, linkedModel: input.linkedModel, linkedId: input.linkedId }),
  });
  const ticket = await response.json() as UploadTicket & { error?: { message?: string } };
  if (!response.ok) throw new Error(ticket.error?.message || 'Upload could not be signed.');
  await put(ticket.uploadUrl, input.file, ticket.headers, input.signal, (loaded) => input.onProgress?.(loaded, input.file.size));
  const complete = await fetch(`/api/admin/uploads/${ticket.assetId}/complete`, { method: 'POST', headers: { 'x-csrf-token': csrf() }, signal: input.signal });
  const result = await complete.json() as { asset?: CompletedUploadAsset; error?: { message?: string } };
  if (!complete.ok || !result.asset) throw new Error(result.error?.message || 'Uploaded object could not be verified.');
  return result.asset;
}
