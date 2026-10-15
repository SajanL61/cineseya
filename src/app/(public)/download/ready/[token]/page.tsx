import type { Metadata } from "next";
import { ArrowLeft, CheckCircle2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CinePoster } from "@/components/ui/cine-artwork";
import { ReadyDownloadActions } from "@/components/movie/ready-download-actions";
import { getReadyDownloadData } from "@/services/download-verification";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "CineSeya Secure Download",
  robots: { index: false, follow: false },
};
const size = (bytes: number) =>
  bytes >= 1_000_000_000
    ? `${(bytes / 1_000_000_000).toFixed(2)} GB`
    : `${Math.max(1, bytes / 1_000_000).toFixed(0)} MB`;

export default async function ReadyDownloadPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await getReadyDownloadData(token);
  if (!data) notFound();
  return (
    <main className="secure-download-page ready-page">
      <header>
        <Link href={data.backHref}>
          <ArrowLeft />
          Back to title
        </Link>
        <span>CineSeya Secure Download</span>
      </header>
      <section className="secure-download-card">
        <div className="secure-download-summary">
          <span>
            <CinePoster
              src={data.posterUrl}
              alt={`${data.title} poster`}
              focalPoint={data.posterFocalPoint}
              fillContainer
              sizes="96px"
            />
          </span>
          <div>
            <small>Ready to download</small>
            <h1>{data.title}</h1>
            <p>
              {data.year ? `${data.year} · ` : ""}
              {data.version.quality} · {data.version.releaseType} ·{" "}
              {data.version.videoCodec} · {size(data.version.fileSize)}
            </p>
          </div>
        </div>
        <div className="ready-download-body">
          <div className="ready-success">
            <ShieldCheck />
            <div>
              <h2>Secure link prepared</h2>
              <p>
                Your verification is complete. The final file token is created
                only when you choose a server.
              </p>
            </div>
          </div>
          <ul className="ready-checks">
            <li>
              <CheckCircle2 />
              File verified
            </li>
            <li>
              <CheckCircle2 />
              Security verified
            </li>
            <li>
              <CheckCircle2 />
              Secure link prepared
            </li>
          </ul>
          <ReadyDownloadActions
            mediaVersionId={data.version.id}
            readyToken={data.readyToken}
            directAvailable={data.version.directAvailable}
            selectedMirrorId={data.selectedMirrorId}
            mirrors={data.version.mirrors}
          />
        </div>
      </section>
    </main>
  );
}
