'use client';

import Image, { type ImageProps } from 'next/image';
import { useState } from 'react';

export type SafeImageProps = Omit<ImageProps, 'src'> & {
  src: string;
  fallbackSrc: string;
};

export function SafeImage({ src, fallbackSrc, alt, onError, ...props }: SafeImageProps) {
  const [failedSrc, setFailedSrc] = useState<string>();
  const resolvedSrc = !src || failedSrc === src ? fallbackSrc : src;

  return <Image {...props} src={resolvedSrc} alt={alt} onError={(event) => {
    onError?.(event);
    if (resolvedSrc === fallbackSrc) return;
    if (process.env.NODE_ENV === 'development') console.warn(`Image failed to load; using fallback for ${src}`);
    setFailedSrc(src);
  }}/>;
}
