import { randomUUID } from 'node:crypto';
import type { UploadKind } from '@/lib/validation/upload';

export function sanitizeStorageFileName(fileName: string) {
  const normalized = fileName.normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, '');
  const base = normalized.split(/[\\/]/).pop() ?? 'file';
  return base.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^[-.]+/, '').slice(-120) || 'file';
}

export function buildStorageObjectKey(input: { kind: UploadKind; purpose?: 'download' | 'stream_master'; fileName: string; linkedModel?: string; linkedId?: string }) {
  const fileName = sanitizeStorageFileName(input.fileName);
  const id = input.linkedId?.replace(/[^a-f0-9]/gi, '') || 'unassigned';
  const nonce = randomUUID();
  if (input.kind === 'poster') return `posters/${input.linkedModel === 'Series' ? 'series' : 'movies'}/${id}/${nonce}-${fileName}`;
  if (input.kind === 'backdrop') return `backdrops/${input.linkedModel === 'Series' ? 'series' : 'movies'}/${id}/${nonce}-${fileName}`;
  if (input.kind === 'avatar') return `avatars/${id}/${nonce}-${fileName}`;
  if (input.kind === 'subtitle') return `subtitles/${input.linkedModel === 'Episode' ? 'episodes' : 'movies'}/${id}/${nonce}-${fileName}`;
  if (input.kind === 'media' && input.purpose === 'stream_master') return `masters/${input.linkedModel === 'Episode' ? 'episodes' : 'movies'}/${id}/${nonce}/original-${fileName}`;
  if (input.kind === 'media') return `downloads/${input.linkedModel === 'Episode' ? 'episodes' : 'movies'}/${id}/${nonce}/${fileName}`;
  return `other/${id}/${nonce}-${fileName}`;
}
