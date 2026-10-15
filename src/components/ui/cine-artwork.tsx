import type { ImageProps } from "next/image";
import { SafeImage } from "@/components/ui/safe-image";
import { focalPointPosition, type FocalPoint } from "@/lib/artwork";

type ArtworkProps = Omit<
  ImageProps,
  "src" | "alt" | "fill" | "width" | "height" | "style" | "priority"
> & {
  src: string;
  alt: string;
  focalPoint?: FocalPoint;
  frameClassName?: string;
  imageClassName?: string;
  fillContainer?: boolean;
};

function frameClass(base: string, extra?: string) {
  return extra ? `${base} ${extra}` : base;
}

export function CinePoster({
  src,
  alt,
  focalPoint,
  frameClassName,
  imageClassName,
  fillContainer = false,
  ...imageProps
}: ArtworkProps) {
  return (
    <span
      className={frameClass("cine-poster", frameClassName)}
      data-fill={fillContainer || undefined}
    >
      <SafeImage
        {...imageProps}
        src={src}
        fallbackSrc="/media/fallback-poster.svg"
        alt={alt}
        fill
        className={imageClassName}
        style={{
          objectFit: "cover",
          objectPosition: focalPointPosition(focalPoint),
        }}
      />
    </span>
  );
}

export function CineBackdrop({
  src,
  alt,
  focalPoint,
  frameClassName,
  imageClassName,
  fillContainer = false,
  ...imageProps
}: ArtworkProps) {
  return (
    <span
      className={frameClass("cine-backdrop", frameClassName)}
      data-fill={fillContainer || undefined}
    >
      <SafeImage
        {...imageProps}
        src={src}
        fallbackSrc="/media/fallback-backdrop.svg"
        alt={alt}
        fill
        className={imageClassName}
        style={{
          objectFit: "cover",
          objectPosition: focalPointPosition(focalPoint),
        }}
      />
    </span>
  );
}
