import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { RequestForm } from '@/components/legal/request-form';
import { legalPages, type LegalPageKey } from '@/data/legal';
import { socialMetadata } from '@/lib/seo';

export function generateStaticParams(){return Object.keys(legalPages).map((page)=>({page}));}
export async function generateMetadata({params}:{params:Promise<{page:string}>}):Promise<Metadata>{const {page}=await params;const data=legalPages[page as LegalPageKey];const route=`/${page}`;return data?{title:data.title,description:data.intro,alternates:{canonical:route},...socialMetadata(data.title,data.intro,route)}:{}}
export default async function LegalPage({params}:{params:Promise<{page:string}>}){const {page}=await params;const data=legalPages[page as LegalPageKey];if(!data)notFound();return <article className="editorial-page"><header><span>{data.eyebrow}</span><h1>{data.title}</h1><p>{data.intro}</p></header><div className="editorial-layout"><aside><span>On this page</span>{data.sections.map(([heading])=><a href={`#${heading.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`} key={heading}>{heading}</a>)}</aside><div className="editorial-body">{data.sections.map(([heading,body])=><section id={heading.toLowerCase().replace(/[^a-z0-9]+/g,'-')} key={heading}><h2>{heading}</h2><p>{body}</p></section>)}{(page==='contact'||page==='takedown')&&<RequestForm type={page}/>}</div></div></article>}
