import type { MetadataRoute } from 'next';
import { SEO_ORIGIN } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin', '/admin/', '/api', '/api/', '/profile', '/watch', '/watch/',
        '/watchlist', '/login', '/register', '/download', '/download/', '/search', '/offline',
      ],
    },
    sitemap: `${SEO_ORIGIN}/sitemap.xml`,
    host: SEO_ORIGIN,
  };
}
