import type { NextConfig } from 'next';

const configuredUrl = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) return undefined;
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error(`${name} must be a credential-free HTTPS URL.`);
  return url;
};
const assetUrl = configuredUrl('PUBLIC_ASSET_DOMAIN');
const downloadUrl = configuredUrl('DOWNLOAD_DOMAIN');
const turnstileEnabled = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
const imageSources = ["'self'", 'data:', 'blob:', 'https://image.tmdb.org', assetUrl?.origin].filter(Boolean).join(' ');
const connectSources = ["'self'", 'https://*.r2.cloudflarestorage.com', downloadUrl?.origin, turnstileEnabled ? 'https://challenges.cloudflare.com' : undefined].filter(Boolean).join(' ');
const mediaSources = ["'self'", 'blob:', 'https://*.r2.cloudflarestorage.com', downloadUrl?.origin].filter(Boolean).join(' ');

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''}${turnstileEnabled ? ' https://challenges.cloudflare.com' : ''}`,
      "style-src 'self' 'unsafe-inline'",
      `img-src ${imageSources}`,
      "font-src 'self' data:",
      `connect-src ${connectSources}`,
      `media-src ${mediaSources}`,
      `frame-src https://www.youtube-nocookie.com${turnstileEnabled ? ' https://challenges.cloudflare.com' : ''}`,
      "worker-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      ...(process.env.NODE_ENV === 'production' ? ['upgrade-insecure-requests'] : []),
    ].join('; '),
  },
  ...(process.env.NODE_ENV === 'production'
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }]
    : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: 'image.tmdb.org', pathname: '/t/p/**' },
      ...(assetUrl ? [{ protocol: 'https' as const, hostname: assetUrl.hostname, port: assetUrl.port, pathname: '/**' }] : []),
    ],
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      { source: '/admin/:path*', headers: [{ key: 'Cache-Control', value: 'private, no-store' }] },
      { source: '/profile/:path*', headers: [{ key: 'Cache-Control', value: 'private, no-store' }] },
      { source: '/watch/:path*', headers: [{ key: 'Cache-Control', value: 'private, no-store' }] },
      { source: '/download/:path*', headers: [{ key: 'Cache-Control', value: 'private, no-store' }] },
      { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' }] },
    ];
  },
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [
          { type: 'host', value: 'cineseya.lk' },
          { type: 'header', key: 'x-forwarded-proto', value: 'http' },
        ],
        destination: 'https://cineseya.lk/:path*',
        permanent: true,
      },
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.cineseya.lk' }],
        destination: 'https://cineseya.lk/:path*',
        permanent: true,
      },
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'cinerusubs.onrender.com' }],
        destination: 'https://cineseya.lk/:path*',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
