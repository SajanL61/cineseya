import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { PwaRegister } from '@/components/pwa/pwa-register';
import { env } from '@/lib/env';
import { SEO_DEFAULT_DESCRIPTION, SEO_DEFAULT_IMAGE, SEO_DEFAULT_TITLE, SEO_ORIGIN } from '@/lib/seo';

export const metadata: Metadata = {
  metadataBase: new URL(SEO_ORIGIN),
  title: { default: SEO_DEFAULT_TITLE, template: '%s | CineSeya' },
  description: SEO_DEFAULT_DESCRIPTION,
  applicationName: 'CineSeya',
  category: 'entertainment',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon-48.png', type: 'image/png', sizes: '48x48' },
      { url: '/icon-192.png', type: 'image/png', sizes: '192x192' },
      { url: '/icon-512.png', type: 'image/png', sizes: '512x512' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
  openGraph: {
    type: 'website', siteName: 'CineSeya', title: SEO_DEFAULT_TITLE,
    description: SEO_DEFAULT_DESCRIPTION, url: SEO_ORIGIN,
    images: [{ url: SEO_DEFAULT_IMAGE, width: 1200, height: 630, alt: 'CineSeya' }],
  },
  twitter: {
    card: 'summary_large_image', title: SEO_DEFAULT_TITLE,
    description: SEO_DEFAULT_DESCRIPTION, images: [SEO_DEFAULT_IMAGE],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 },
  },
  verification: env.GOOGLE_SITE_VERIFICATION ? { google: env.GOOGLE_SITE_VERIFICATION } : undefined,
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#080a0f', colorScheme: 'dark' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en" data-scroll-behavior="smooth"><head><link rel="icon" href="/favicon.ico" sizes="any"/><link rel="icon" href="/icon-48.png" type="image/png" sizes="48x48"/><link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180"/></head><body><PwaRegister />{children}</body></html>;
}
