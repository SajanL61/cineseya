import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SecureDownloadVerification as DownloadPreparation } from '@/components/movie/secure-download-verification';
import { getDownloadPageData } from '@/services/downloads';
import { SafeImage } from '@/components/ui/safe-image';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Secure download', robots: { index: false, follow: false } };
const size = (bytes: number) => bytes >= 1_000_000_000 ? `${(bytes / 1_000_000_000).toFixed(1)} GB` : `${Math.max(1, bytes / 1_000_000).toFixed(0)} MB`;

export default async function DownloadPage({ params }: PageProps<'/download/[mediaId]'>) {
  const { mediaId } = await params; const data = await getDownloadPageData(mediaId); if (!data) notFound();
  return <main className="secure-download-page"><header><Link href={data.backHref}><ArrowLeft/>Back to title</Link><span>CineSeya.lk secure delivery</span></header><section className="secure-download-card"><div className="secure-download-summary"><span><SafeImage src={data.posterUrl} fallbackSrc="/media/fallback-poster.svg" alt={`${data.title} poster`} fill loading="eager" sizes="96px"/></span><div><small>Ready to prepare</small><h1>{data.title}</h1><p>{data.version.quality} · {data.version.releaseType} · {data.version.videoCodec} · {size(data.version.fileSize)}</p><div>{[data.version.container, data.version.audioCodec, ...data.version.audioLanguages.map((language) => `${language} audio`)].filter(Boolean).map((label) => <em key={label}>{label}</em>)}</div></div></div><DownloadPreparation mediaVersionId={data.version.id} directAvailable={data.version.directAvailable} mirrors={data.version.mirrors}/></section></main>;
}
