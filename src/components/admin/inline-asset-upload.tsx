"use client";

import {
  CheckCircle2,
  CloudUpload,
  ExternalLink,
  LoaderCircle,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import {
  uploadDirectAsset,
  type CompletedUploadAsset,
} from "@/lib/client/direct-upload";
import { inspectBrowserImage } from "@/lib/client/artwork-file";
import type { ArtworkMetadata } from "@/lib/artwork";

export function InlineAssetUpload({
  kind,
  linkedModel = "Movie",
  linkedId,
  onSelected,
  onUploaded,
}: {
  kind: "poster" | "backdrop";
  linkedModel?: "Movie" | "Series";
  linkedId?: string;
  onSelected?: (file: File, metadata: ArtworkMetadata) => void;
  onUploaded: (asset: CompletedUploadAsset) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null);
  const [pending, setPending] = useState(false);
  const [percent, setPercent] = useState(0);
  const [error, setError] = useState("");
  const [asset, setAsset] = useState<CompletedUploadAsset | null>(null);

  async function upload(file?: File) {
    if (!file) return;
    const abort = new AbortController();
    controller.current = abort;
    setPending(true);
    setPercent(0);
    setError("");
    setAsset(null);
    try {
      const metadata = await inspectBrowserImage(file);
      onSelected?.(file, metadata);
      const completed = await uploadDirectAsset({
        kind,
        file,
        signal: abort.signal,
        linkedModel,
        linkedId,
        onProgress: (loaded, total) =>
          setPercent(Math.round((loaded / total) * 100)),
      });
      setPercent(100);
      setAsset(completed);
      onUploaded(completed);
      if (input.current) input.current.value = "";
    } catch (cause) {
      setError(
        cause instanceof DOMException && cause.name === "AbortError"
          ? "Upload cancelled."
          : cause instanceof Error
            ? cause.message
            : "Upload failed.",
      );
    } finally {
      controller.current = null;
      setPending(false);
    }
  }

  return (
    <div className="inline-asset-upload">
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        hidden
        onChange={(event) => void upload(event.target.files?.[0])}
      />
      <button
        className="admin-primary"
        type="button"
        disabled={pending}
        onClick={() => input.current?.click()}
      >
        {pending ? <LoaderCircle className="spin" /> : <CloudUpload />}
        {pending ? `Uploading ${percent}%` : `Upload ${kind}`}
      </button>
      {pending && (
        <button
          className="admin-danger"
          type="button"
          onClick={() => controller.current?.abort()}
        >
          <X />
          Cancel
        </button>
      )}
      {asset && (
        <span className="inline-upload-success">
          <CheckCircle2 />
          Uploaded and field updated
          {asset.publicUrl && (
            <a href={asset.publicUrl} target="_blank" rel="noreferrer">
              Preview <ExternalLink />
            </a>
          )}
        </span>
      )}
      {error && <span className="inline-upload-error">{error}</span>}
    </div>
  );
}
