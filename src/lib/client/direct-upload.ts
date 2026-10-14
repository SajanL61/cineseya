'use client';

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

type ServerUploadKind = 'poster' | 'backdrop' | 'subtitle' | 'avatar' | 'other';
type ServerUploadResponse = { asset?: CompletedUploadAsset; error?: { message?: string } };

const csrf = readCsrfToken;
export const uploadMimeType = (file: File) => file.type || ({ mkv: 'video/x-matroska', m3u8: 'application/vnd.apple.mpegurl' }[file.name.split('.').pop()?.toLocaleLowerCase() || ''] || 'application/octet-stream');

function uploadThroughServer(url: string, file: File, contentType: string, signal: AbortSignal, onProgress?: (loaded: number, total: number) => void) {
  return new Promise<CompletedUploadAsset>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', url);
    request.responseType = 'json';
    request.setRequestHeader('Content-Type', contentType);
    request.setRequestHeader('x-csrf-token', csrf());
    request.upload.onprogress = (event) => onProgress?.(event.loaded, file.size);
    request.onerror = () => reject(new Error('The CineSeya upload service could not be reached.'));
    request.onload = () => {
      const payload = request.response as ServerUploadResponse | null;
      if (request.status >= 200 && request.status < 300 && payload?.asset) resolve(payload.asset);
      else reject(new Error(payload?.error?.message || `Upload failed (${request.status}).`));
    };
    const abort = () => { request.abort(); reject(new DOMException('Upload cancelled.', 'AbortError')); };
    signal.addEventListener('abort', abort, { once: true });
    request.onloadend = () => signal.removeEventListener('abort', abort);
    request.send(file);
  });
}

export async function uploadDirectAsset(input: {
  kind: ServerUploadKind;
  file: File;
  signal: AbortSignal;
  purpose?: 'download';
  linkedModel?: string;
  linkedId?: string;
  onProgress?: (loaded: number, total: number) => void;
}) {
  const contentType = uploadMimeType(input.file);
  const search = new URLSearchParams({
    kind: input.kind,
    fileName: input.file.name,
    contentType,
    size: String(input.file.size),
    purpose: input.purpose || 'download',
  });
  if (input.linkedModel) search.set('linkedModel', input.linkedModel);
  if (input.linkedId) search.set('linkedId', input.linkedId);
  return uploadThroughServer(`/api/admin/uploads/proxy?${search}`, input.file, contentType, input.signal, input.onProgress);
}
