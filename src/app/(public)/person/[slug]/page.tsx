import type { Metadata } from 'next';
import { UserRound } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CatalogGrid } from '@/components/movie/catalog-grid';
import { NonceJsonLd } from '@/components/seo/nonce-json-ld';
import { getMovies } from '@/services/catalog';
import { breadcrumbJsonLd, canonicalUrl, conciseDescription, socialMetadata } from '@/lib/seo';

export const dynamic='force-dynamic';

async function personRecord(slug:string){const movies=await getMovies();const credits=movies.filter(movie=>[...movie.cast,...movie.crew].some(person=>person.slug===slug));const person=credits.flatMap(movie=>[...movie.cast,...movie.crew]).find(item=>item.slug===slug);return{person,credits};}

export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{const {slug}=await params;const {person,credits}=await personRecord(slug);if(!person)return{};const role=person.role??person.character??'Film contributor';const title=`${person.name} — Movies & Credits`;const description=conciseDescription(`${person.name} is credited as ${role} in ${credits.map(movie=>movie.title).join(', ')}. Browse published title details on CineSeya.`,`View movie credits for ${person.name} on CineSeya.`);const route=`/person/${slug}`;return{title,description,alternates:{canonical:route},...socialMetadata(title,description,route)};}

export default async function PersonPage({params}:{params:Promise<{slug:string}>}){
  const {slug}=await params;
  const {person,credits}=await personRecord(slug);
  if(!person)notFound();
  const route=`/person/${slug}`;
  const role=person.role??person.character??'Film contributor';
  const schema={'@context':'https://schema.org','@type':'Person','@id':`${canonicalUrl(route)}#person`,name:person.name,jobTitle:person.role??(person.character?'Actor':undefined),url:canonicalUrl(route)};
  const breadcrumb=breadcrumbJsonLd([{name:'Home',path:'/'},{name:'People',path:'/movies'},{name:person.name,path:route}]);
  return <><NonceJsonLd value={schema}/><NonceJsonLd value={breadcrumb}/><div className="page-shell person-page"><nav aria-label="Breadcrumb"><Link href="/">Home</Link><span>/</span><Link href="/movies">Movies</Link><span>/</span><span>{person.name}</span></nav><header><span><UserRound/></span><div><p className="eyebrow">Cast &amp; crew</p><h1>{person.name}</h1><p>{role}</p></div></header><section><h2>Known for</h2><CatalogGrid movies={credits}/></section></div></>;
}
