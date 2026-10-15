import Link from 'next/link';
import { Facebook, Instagram, MessageCircle, Send, Youtube } from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import { getSocialSettings } from '@/services/site-settings';
import { getAdSettings } from '@/services/ad-settings';
import { PrivacyChoicesButton } from '@/components/ads/privacy-choices-button';

export async function SiteFooter() {
  const [social, ads] = await Promise.all([getSocialSettings(), getAdSettings()]);
  const socialLinks = [{ key: 'facebook', label: 'Facebook', icon: Facebook }, { key: 'telegram', label: 'Telegram', icon: Send }, { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle }, { key: 'instagram', label: 'Instagram', icon: Instagram }, { key: 'youtube', label: 'YouTube', icon: Youtube }] as const;
  return <footer className="site-footer"><div className="footer-grid">
    <section className="footer-intro"><Logo large /><p>Premium movie, TV and subtitle discovery with carefully crafted Sinhala support and rights-aware media access.</p><nav className="footer-social" aria-label="Social and community links">{socialLinks.filter(({key})=>Boolean(social[key])).map(({key,label,icon:Icon})=><a href={social[key]} target="_blank" rel="noopener noreferrer" aria-label={label} key={key}><Icon/></a>)}</nav></section>
    <section><h2>Explore</h2><Link href="/movies">Movies</Link><Link href="/tv">TV Series</Link><Link href="/subtitles">Subtitles</Link><Link href="/discover">Discover</Link></section>
    <section><h2>Browse</h2><Link href="/discover?sort=trending">Trending</Link><Link href="/movies?sort=newest">New Releases</Link><Link href="/genres">Genres</Link><Link href="/languages">Languages</Link></section>
    <section><h2>CineSeya.lk</h2><Link href="/about">About</Link><Link href="/contact">Contact</Link><Link href="/copyright">Copyright</Link><Link href="/takedown">Takedown request</Link></section>
  </div><div className="footer-bottom"><span>© {new Date().getFullYear()} CineSeya.lk. Discover cinema responsibly.</span><nav><Link href="/privacy">Privacy</Link><PrivacyChoicesButton enabled={ads.mode === 'live' && ads.masterEnabled && ads.consent.configured}/><Link href="/terms">Terms</Link><Link href="/accessibility">Accessibility</Link></nav></div></footer>;
}
