import type { Metadata } from 'next';
import { BadgeCheck, CalendarDays, Star } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SubtitleCard } from '@/components/subtitle/subtitle-card';
import { SafeImage } from '@/components/ui/safe-image';
import { getTranslatorBySlug, getTranslatorSubtitles } from '@/services/catalog';
import { NonceJsonLd } from '@/components/seo/nonce-json-ld';
import { breadcrumbJsonLd, canonicalUrl, conciseDescription, publicSeoImage } from '@/lib/seo';

export const dynamic='force-dynamic';
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{const {slug}=await params;const t=await getTranslatorBySlug(slug);if(!t)return{};const route=`/translator/${t.slug}`;const title=`${t.displayName} — Sinhala Subtitle Translator`;const description=conciseDescription(t.bio,`View published subtitle contributions by ${t.displayName} on CineSeya.`);const image=publicSeoImage(t.avatarUrl);return{title,description,alternates:{canonical:route},robots:t.totalSubtitles>0?{index:true,follow:true}:{index:false,follow:true},openGraph:{type:'profile',siteName:'CineSeya',title,description,url:canonicalUrl(route),images:[{url:image,alt:t.displayName}]},twitter:{card:'summary_large_image',title,description,images:[image]}};}
export default async function TranslatorPage({params}:{params:Promise<{slug:string}>}) {
  const {slug}=await params;
  const translator=await getTranslatorBySlug(slug);
  if(!translator)notFound();
  const subtitles=await getTranslatorSubtitles(translator.id);
  const route=`/translator/${translator.slug}`;
  const personId=`${canonicalUrl(route)}#person`;
  const schema={
    '@context':'https://schema.org',
    '@type':'ProfilePage',
    '@id':`${canonicalUrl(route)}#profile`,
    url:canonicalUrl(route),
    dateCreated:translator.joinedAt,
    dateModified:translator.updatedAt,
    mainEntity:{'@type':'Person','@id':personId,name:translator.displayName,description:translator.bio,image:translator.avatarUrl?publicSeoImage(translator.avatarUrl):undefined,url:canonicalUrl(route)},
  };
  const breadcrumb=breadcrumbJsonLd([{name:'Home',path:'/'},{name:'Subtitle Translators',path:'/subtitles'},{name:translator.displayName,path:route}]);
  return <>
    <NonceJsonLd value={schema}/><NonceJsonLd value={breadcrumb}/>
    <div className="page-shell translator-page">
      <nav aria-label="Breadcrumb"><Link href="/">Home</Link><span>/</span><Link href="/subtitles">Subtitles</Link><span>/</span><span>{translator.displayName}</span></nav>
      <header className="translator-hero">
        {translator.avatarUrl&&<span><SafeImage src={translator.avatarUrl} fallbackSrc="/media/fallback-poster.svg" alt={`${translator.displayName} profile`} fill sizes="120px"/></span>}
        <div><div className="verified-name"><h1>{translator.displayName}</h1>{translator.verified&&<BadgeCheck/>}</div><p>{translator.bio}</p><div className="translator-stats"><span><b>{translator.totalSubtitles}</b>Subtitles</span><span><b>{translator.totalDownloads.toLocaleString()}</b>Downloads</span><span><b><Star/>{translator.averageRating.toFixed(1)}</b>Average rating</span><span><b><CalendarDays/>{new Date(translator.joinedAt).toLocaleDateString('en-LK',{month:'short',year:'numeric'})}</b>Joined</span></div></div>
      </header>
      <section className="translator-releases"><header><span className="section-label">Contribution history</span><h2>Recent subtitles</h2></header><div className="subtitle-list">{subtitles.map(item=><SubtitleCard key={item.id} subtitle={item}/>)}</div></section>
    </div>
  </>;
}
