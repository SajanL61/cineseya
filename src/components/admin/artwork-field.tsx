"use client";

import { Crosshair, RotateCcw } from "lucide-react";
import { useEffect, useState, type MouseEvent } from "react";
import { CineBackdrop, CinePoster } from "@/components/ui/cine-artwork";
import {
  artworkAssessment,
  DEFAULT_FOCAL_POINT,
  formatArtworkBytes,
  normalizeFocalPoint,
  type ArtworkKind,
  type ArtworkMetadata,
  type FocalPoint,
} from "@/lib/artwork";
import { InlineAssetUpload } from "./inline-asset-upload";

type ArtworkFieldProps = {
  kind: ArtworkKind;
  linkedModel: "Movie" | "Series";
  linkedId?: string;
  initialUrl?: string;
  initialPreviewUrl?: string;
  initialFocalPoint?: unknown;
  initialMetadata?: unknown;
};

const presets: Array<{ label: string; point: FocalPoint }> = [
  { label: "Center", point: { x: 50, y: 50 } },
  { label: "Top", point: { x: 50, y: 20 } },
  { label: "Bottom", point: { x: 50, y: 80 } },
  { label: "Left", point: { x: 25, y: 50 } },
  { label: "Right", point: { x: 75, y: 50 } },
];

export function ArtworkField({
  kind,
  linkedModel,
  linkedId,
  initialUrl,
  initialPreviewUrl,
  initialFocalPoint,
  initialMetadata,
}: ArtworkFieldProps) {
  const fallback =
    kind === "poster"
      ? "/media/fallback-poster.svg"
      : "/media/fallback-backdrop.svg";
  const [url, setUrl] = useState(initialUrl || fallback);
  const [previewUrl, setPreviewUrl] = useState(
    initialPreviewUrl || initialUrl || fallback,
  );
  const [temporaryUrl, setTemporaryUrl] = useState("");
  const [focalPoint, setFocalPoint] = useState(() =>
    normalizeFocalPoint(initialFocalPoint),
  );
  const [metadata, setMetadata] = useState<
    Partial<ArtworkMetadata> | undefined
  >(() =>
    initialMetadata && typeof initialMetadata === "object"
      ? (initialMetadata as Partial<ArtworkMetadata>)
      : undefined,
  );
  const label = kind === "poster" ? "Poster" : "Backdrop";
  const Artwork = kind === "poster" ? CinePoster : CineBackdrop;

  useEffect(
    () => () => {
      if (temporaryUrl) URL.revokeObjectURL(temporaryUrl);
    },
    [temporaryUrl],
  );

  function selectFocalPoint(event: MouseEvent<HTMLButtonElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    setFocalPoint({
      x: Math.round(
        Math.max(
          0,
          Math.min(100, ((event.clientX - bounds.left) / bounds.width) * 100),
        ),
      ),
      y: Math.round(
        Math.max(
          0,
          Math.min(100, ((event.clientY - bounds.top) / bounds.height) * 100),
        ),
      ),
    });
  }

  const messages = artworkAssessment(kind, metadata);
  return (
    <section className={`span-2 artwork-editor artwork-editor-${kind}`}>
      <div className="artwork-editor-fields">
        <label>
          {label} URL or uploaded asset path
          <input
            name={`${kind}Url`}
            required
            value={url}
            onChange={(event) => {
              setUrl(event.target.value);
              setPreviewUrl(event.target.value || fallback);
            }}
          />
        </label>
        <InlineAssetUpload
          kind={kind}
          linkedModel={linkedModel}
          linkedId={linkedId}
          onSelected={(file, nextMetadata) => {
            const objectUrl = URL.createObjectURL(file);
            setTemporaryUrl(objectUrl);
            setPreviewUrl(objectUrl);
            setMetadata(nextMetadata);
          }}
          onUploaded={(asset) => {
            setUrl(asset.objectKey);
            setPreviewUrl(asset.publicUrl || previewUrl);
            setMetadata(asset.metadata || metadata);
          }}
        />
        <div className="artwork-metadata" aria-live="polite">
          <strong>
            {metadata?.width && metadata?.height
              ? `${metadata.width} × ${metadata.height}px`
              : "Source dimensions pending"}
          </strong>
          {metadata?.fileSize ? (
            <span>{formatArtworkBytes(metadata.fileSize)}</span>
          ) : null}
          <span>
            Target: {kind === "poster" ? "2:3" : "16:9"} · automatic cover crop
          </span>
          {messages.map((message) => (
            <span
              className={`artwork-note-${message.tone}`}
              key={message.message}
            >
              {message.message}
            </span>
          ))}
        </div>
      </div>
      <div className="artwork-focal-editor">
        <span className="artwork-focal-title">
          <Crosshair />
          Click the real frame to position the focal point
        </span>
        <button
          className="artwork-preview-button"
          type="button"
          onClick={selectFocalPoint}
          aria-label={`Set ${label.toLocaleLowerCase()} focal point`}
        >
          <Artwork
            src={previewUrl || fallback}
            alt={`${label} crop preview`}
            focalPoint={focalPoint}
            sizes={
              kind === "poster"
                ? "(max-width: 700px) 85vw, 300px"
                : "(max-width: 700px) 90vw, 560px"
            }
          />
          <span
            className="artwork-focal-marker"
            style={{ left: `${focalPoint.x}%`, top: `${focalPoint.y}%` }}
          />
        </button>
        <div className="artwork-presets">
          {presets.map((preset) => (
            <button
              type="button"
              key={preset.label}
              onClick={() => setFocalPoint(preset.point)}
            >
              {preset.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setFocalPoint(DEFAULT_FOCAL_POINT)}
          >
            <RotateCcw />
            Reset
          </button>
        </div>
        <small>
          Focal point: {focalPoint.x}% × {focalPoint.y}%. The original image is
          never modified.
        </small>
        <input type="hidden" name={`${kind}FocalX`} value={focalPoint.x} />
        <input type="hidden" name={`${kind}FocalY`} value={focalPoint.y} />
      </div>
    </section>
  );
}
