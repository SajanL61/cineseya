import { Buffer } from 'node:buffer';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

function httpsOrigin(name: string) {
  const value = process.env[name]?.trim();
  if (!value) return undefined;
  try { const url = new URL(value); return url.protocol === 'https:' ? url.origin : undefined; } catch { return undefined; }
}

function contentSecurityPolicy(nonce: string, admin: boolean) {
  const development = process.env.NODE_ENV === 'development';
  const assetOrigin = httpsOrigin('PUBLIC_ASSET_DOMAIN');
  const downloadOrigin = httpsOrigin('DOWNLOAD_DOMAIN');
  const turnstile = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
  const images = ["'self'", 'data:', 'blob:', 'https://image.tmdb.org', 'https://assets.cineseya.lk', assetOrigin].filter(Boolean).join(' ');
  const media = ["'self'", 'blob:', 'https://*.r2.cloudflarestorage.com', downloadOrigin].filter(Boolean).join(' ');
  const connect = ["'self'", 'https://*.r2.cloudflarestorage.com', downloadOrigin, turnstile ? 'https://challenges.cloudflare.com' : undefined];
  const frames = ['https://www.youtube-nocookie.com', turnstile ? 'https://challenges.cloudflare.com' : undefined];
  const scripts = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", development ? "'unsafe-eval'" : undefined];
  if (!admin) {
    scripts.push('https://pagead2.googlesyndication.com', 'https://fundingchoicesmessages.google.com');
    connect.push('https://pagead2.googlesyndication.com', 'https://googleads.g.doubleclick.net', 'https://ep1.adtrafficquality.google', 'https://ep2.adtrafficquality.google', 'https://fundingchoicesmessages.google.com');
    frames.push('https://googleads.g.doubleclick.net', 'https://tpc.googlesyndication.com', 'https://fundingchoicesmessages.google.com', 'https://www.google.com');
  }
  return [
    "default-src 'self'",
    `script-src ${scripts.filter(Boolean).join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src ${images}`,
    "font-src 'self' data:",
    `connect-src ${connect.filter(Boolean).join(' ')}`,
    `media-src ${media}`,
    `frame-src ${frames.filter(Boolean).join(' ')}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(process.env.NODE_ENV === 'production' ? ['upgrade-insecure-requests'] : []),
  ].join('; ');
}

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const admin = request.nextUrl.pathname === '/admin' || request.nextUrl.pathname.startsWith('/admin/');
  const csp = contentSecurityPolicy(nonce, admin);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: [{
    source: '/((?!api|_next/static|_next/image|icon.png|apple-icon.png|manifest.webmanifest|robots.txt|sitemap.xml|sw.js).*)',
    missing: [
      { type: 'header', key: 'next-router-prefetch' },
      { type: 'header', key: 'purpose', value: 'prefetch' },
    ],
  }],
};
