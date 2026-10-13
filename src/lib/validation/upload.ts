import { z } from 'zod';
import JSZip from 'jszip';

export const uploadKinds = ['poster','backdrop','subtitle','media','avatar','other'] as const;
export type UploadKind = (typeof uploadKinds)[number];
const limits: Record<UploadKind, number> = { poster: 15_000_000, backdrop: 25_000_000, subtitle: 5_000_000, media: 200_000_000_000, avatar: 8_000_000, other: 25_000_000 };
const accepted: Record<UploadKind, RegExp> = {
  poster: /^image\/(jpeg|png|webp|avif)$/i, backdrop: /^image\/(jpeg|png|webp|avif)$/i, avatar: /^image\/(jpeg|png|webp|avif)$/i,
  subtitle: /^(application\/(x-subrip|zip|x-zip-compressed)|text\/(plain|vtt)|application\/(octet-stream|x-ass))$/i,
  media: /^(video\/(mp4|webm|x-matroska|quicktime)|application\/(vnd\.apple\.mpegurl|x-mpegURL|octet-stream))$/i,
  other: /^[a-z]+\/[a-z0-9.+-]+$/i,
};
const extensions: Record<UploadKind, Set<string>> = {
  poster: new Set(['jpg','jpeg','png','webp','avif']), backdrop: new Set(['jpg','jpeg','png','webp','avif']), avatar: new Set(['jpg','jpeg','png','webp','avif']),
  subtitle: new Set(['srt','ass','vtt','zip']), media: new Set(['mp4','webm','mkv','mov','m3u8']), other: new Set(['pdf','txt','json','csv']),
};
const extensionOf = (fileName: string) => fileName.split('.').pop()?.toLocaleLowerCase() ?? '';

function hasUnsafeFilePath(fileName: string) {
  const normalized = fileName.normalize('NFKC');
  return /[\u0000-\u001f\u007f]/.test(normalized)
    || normalized.includes('/')
    || normalized.includes('\\')
    || /^[a-z]:/i.test(normalized)
    || normalized === '.'
    || normalized === '..';
}

export const presignUploadSchema = z.object({ kind: z.enum(uploadKinds), purpose: z.enum(['download', 'stream_master']).optional().default('download'), fileName: z.string().trim().min(1).max(240), contentType: z.string().trim().min(3).max(120), size: z.number().int().positive(), checksum: z.string().trim().max(128).optional(), linkedModel: z.string().trim().max(80).optional(), linkedId: z.string().trim().max(80).optional() }).superRefine((value,context)=>{
  if(hasUnsafeFilePath(value.fileName))context.addIssue({code:'custom',path:['fileName'],message:'File name must not contain a path or control characters.'});
  if(value.size>limits[value.kind])context.addIssue({code:'custom',path:['size'],message:`File exceeds the ${Math.round(limits[value.kind]/1_000_000)} MB limit for ${value.kind}.`});
  if(!accepted[value.kind].test(value.contentType))context.addIssue({code:'custom',path:['contentType'],message:`File type is not allowed for ${value.kind}.`});
  if(!extensions[value.kind].has(extensionOf(value.fileName)))context.addIssue({code:'custom',path:['fileName'],message:`File extension is not allowed for ${value.kind}.`});
  if(value.purpose==='stream_master'&&value.kind!=='media')context.addIssue({code:'custom',path:['purpose'],message:'Only media uploads can be streaming masters.'});
});

export const multipartPartSchema = z.object({
  uploadId: z.string().trim().min(1).max(1_000),
  partNumber: z.number().int().min(1).max(10_000),
});

export const multipartCompleteSchema = z.object({
  uploadId: z.string().trim().min(1).max(1_000),
  parts: z.array(z.object({
    ETag: z.string().trim().min(1).max(500),
    PartNumber: z.number().int().min(1).max(10_000),
  })).min(1).max(10_000),
}).superRefine((value, context) => {
  value.parts.forEach((part, index) => {
    if (part.PartNumber !== index + 1) context.addIssue({ code: 'custom', path: ['parts', index, 'PartNumber'], message: 'Multipart parts must be unique and ordered from 1.' });
  });
});

export const multipartAbortSchema = z.object({ uploadId: z.string().trim().min(1).max(1_000) });

export const uploadLimitFor = (kind: UploadKind) => limits[kind];

export async function validateSubtitleArchive(bytes: Uint8Array) {
  let archive: JSZip;
  try { archive = await JSZip.loadAsync(bytes, { checkCRC32: true }); }
  catch { throw Object.assign(new Error('The ZIP archive is damaged or unreadable.'), { status: 422, code: 'INVALID_ARCHIVE' }); }
  const files = Object.values(archive.files).filter((entry) => !entry.dir);
  if (!files.length || files.length > 100) throw Object.assign(new Error('A subtitle ZIP must contain between 1 and 100 files.'), { status: 422, code: 'INVALID_ARCHIVE' });
  let expandedSize = 0;
  for (const entry of files) {
    const originalName = (entry as typeof entry & { unsafeOriginalName?: string }).unsafeOriginalName ?? entry.name;
    const normalized = originalName.replaceAll('\\', '/');
    const segments = normalized.split('/');
    if (normalized.startsWith('/') || segments.includes('..') || !['srt','ass','vtt'].includes(extensionOf(normalized))) {
      throw Object.assign(new Error('Subtitle ZIP archives may contain only .srt, .ass, or .vtt files.'), { status: 422, code: 'INVALID_ARCHIVE_CONTENT' });
    }
    expandedSize += (await entry.async('uint8array')).byteLength;
    if (expandedSize > 20_000_000) throw Object.assign(new Error('The expanded subtitle archive is too large.'), { status: 422, code: 'ARCHIVE_TOO_LARGE' });
  }
  return { fileCount: files.length, expandedSize };
}
