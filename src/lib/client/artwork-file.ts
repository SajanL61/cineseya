'use client';

import type { ArtworkMetadata } from '@/lib/artwork';

export async function inspectBrowserImage(file: File): Promise<ArtworkMetadata> {
  let width = 0;
  let height = 0;
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    width = bitmap.width;
    height = bitmap.height;
    bitmap.close();
  } else {
    const url = URL.createObjectURL(file);
    try {
      const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
        image.onerror = () => reject(new Error('The selected image could not be decoded.'));
        image.src = url;
      });
      width = dimensions.width;
      height = dimensions.height;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  if (!width || !height) throw new Error('The selected image has invalid dimensions.');
  return { width, height, aspectRatio: width / height, mimeType: file.type, fileSize: file.size };
}
