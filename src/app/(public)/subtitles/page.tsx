import type { Metadata } from 'next';
import Link from 'next/link';
import { SubtitleCard } from '@/components/subtitle/subtitle-card';
import { getSubtitles } from '@/services/catalog';
import { socialMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';
export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<Metadata> { const params = await searchParams; const filtered = Object.values(params).some((value) => value !== undefined && value !== ''); const title = 'Sinhala Subtitles & Release-Matched Downloads'; const description = 'Browse published Sinhala, English and Tamil subtitle files with clear release matching and translator credit.'; return { title, description, alternates: { canonical: '/subtitles' }, robots: filtered ? { index: false, follow: true } : { index: true, follow: true }, ...socialMetadata(title, description, '/subtitles') }; }
export default async function SubtitlesPage() { const subtitles = await getSubtitles(); return <div className="page-shell subtitles-page"><header className="page-heading"><div><span>Precision-timed by contributors</span><h1>Subtitles</h1><p>Verified release matching, clear formats and translator attribution—so you know exactly what you are downloading.</p></div><strong className="result-count">{subtitles.length} releases</strong></header><nav className="language-tabs"><Link className="active" href="/subtitles">All languages</Link><Link href="/subtitles/sinhala">Sinhala</Link><Link href="/subtitles/english">English</Link><Link href="/subtitles/tamil">Tamil</Link></nav><div className="subtitle-list">{subtitles.map((subtitle) => <SubtitleCard key={subtitle.id} subtitle={subtitle}/>)}</div></div>; }
