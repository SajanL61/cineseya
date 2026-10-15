export type FocalPoint = { x: number; y: number };
export type ArtworkKind = 'poster' | 'backdrop';
export type ArtworkMetadata = {
  width: number;
  height: number;
  aspectRatio: number;
  mimeType: string;
  fileSize: number;
};

export const DEFAULT_FOCAL_POINT: FocalPoint = Object.freeze({ x: 50, y: 50 });

const finitePercent = (value: unknown, fallback: number) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(100, Math.max(0, number)) : fallback;
};

export function normalizeFocalPoint(value: unknown): FocalPoint {
  const point = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return { x: finitePercent(point.x, 50), y: finitePercent(point.y, 50) };
}

export function focalPointPosition(value: unknown) {
  const point = normalizeFocalPoint(value);
  return `${point.x}% ${point.y}%`;
}

export function artworkAssessment(kind: ArtworkKind, metadata?: Partial<ArtworkMetadata> | null) {
  const width = Number(metadata?.width ?? 0);
  const height = Number(metadata?.height ?? 0);
  if (!width || !height) return [{ tone: 'neutral' as const, message: 'The original dimensions will be shown after selecting an image.' }];
  const targetRatio = kind === 'poster' ? 2 / 3 : 16 / 9;
  const actualRatio = width / height;
  const messages: Array<{ tone: 'success' | 'warning' | 'neutral'; message: string }> = [];
  const lowResolution = kind === 'poster' ? width < 600 || height < 900 : width < 1280 || height < 720;
  const idealResolution = kind === 'poster' ? width >= 1000 && height >= 1500 : width >= 1920 && height >= 1080;
  const cropped = Math.abs(actualRatio - targetRatio) / targetRatio > 0.08;
  if (idealResolution) messages.push({ tone: 'success', message: 'Excellent source resolution.' });
  else if (lowResolution) messages.push({ tone: 'warning', message: kind === 'poster' ? 'Low resolution poster. It may appear soft on larger screens.' : 'Low resolution backdrop. It may appear soft on large displays.' });
  else messages.push({ tone: 'success', message: 'Good source resolution.' });
  if (cropped) messages.push({ tone: 'warning', message: `Will be automatically cropped to the ${kind === 'poster' ? '2:3 poster' : '16:9 backdrop'} frame.` });
  else messages.push({ tone: 'neutral', message: `Aspect ratio is close to ${kind === 'poster' ? '2:3' : '16:9'}.` });
  return messages;
}

export function formatArtworkBytes(bytes: number) {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${Math.max(1, Math.ceil(bytes / 1_000))} KB`;
}
