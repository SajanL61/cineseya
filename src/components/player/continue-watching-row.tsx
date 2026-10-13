import { Play } from 'lucide-react';
import Link from 'next/link';
import { SafeImage } from '@/components/ui/safe-image';
import type { ContinueWatchingItem } from '@/services/viewing';

function remaining(seconds: number) {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  if (minutes < 60) return `${minutes} min remaining`;
  const hours = Math.floor(minutes / 60); const rest = minutes % 60;
  return `${hours}h${rest ? ` ${rest}m` : ''} remaining`;
}

export function ContinueWatchingRow({ items }: { items: ContinueWatchingItem[] }) {
  if (!items.length) return null;
  return <section className="media-section continue-watching"><header className="section-heading"><div><span>Pick up exactly where you stopped</span><h2>Continue Watching</h2></div></header><div className="continue-watching-row">{items.map((item) => <article key={`${item.contentType}-${item.contentId}`}>
    <Link className="continue-artwork" href={item.watchHref} aria-label={`Resume ${item.title}`}><SafeImage src={item.posterUrl} fallbackSrc="/media/fallback-backdrop.svg" alt="" fill sizes="(max-width: 700px) 78vw, 320px"/><span><Play/></span></Link>
    <div className="continue-progress" aria-label={`${item.progressPercent}% watched`}><i style={{ width: `${item.progressPercent}%` }}/></div>
    <div><Link href={item.contentHref}><b>{item.title}</b></Link>{item.subtitle && <small>{item.subtitle}</small>}<span>{remaining(item.timeRemaining)}</span></div>
  </article>)}</div></section>;
}
