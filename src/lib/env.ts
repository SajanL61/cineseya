import { z } from 'zod';

const optionalUrl = z.preprocess(
  (value) => typeof value === 'string' && value.trim() === '' ? undefined : value,
  z.url().optional(),
);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  NEXT_PUBLIC_SITE_URL: z.url().default('http://localhost:4001'),
  NEXT_PUBLIC_SITE_NAME: z.string().default('CineSeya.lk'),
  GOOGLE_SITE_VERIFICATION: z.string().trim().optional(),
  MONGODB_URI: z.string().optional(),
  MONGODB_DB: z.literal('cinerusubs').default('cinerusubs'),
  SESSION_SECRET: z.string().min(32).default('development-only-session-secret-change-now'),
  DOWNLOAD_SIGNING_SECRET: z.string().min(32).default('development-only-download-secret-change'),
  CINESEYA_DEMO_MODE: z.enum(['true', 'false']).default('false'),
  CINERUSUBS_DEMO_MODE: z.enum(['true', 'false']).optional(),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_ENDPOINT: z.url().optional(),
  R2_MEDIA_BUCKET: z.string().default('cineseya-media'),
  R2_ASSETS_BUCKET: z.string().default('cineseya-assets'),
  PUBLIC_ASSET_DOMAIN: optionalUrl,
  DOWNLOAD_DOMAIN: optionalUrl,
  DOWNLOAD_WORKER_ENABLED: z.enum(['true', 'false']).default('false'),
  TRANSCODE_WORKER_ENABLED: z.enum(['true', 'false']).default('false'),
  TRANSCODE_CONCURRENCY: z.coerce.number().int().min(1).max(4).default(1),
  TRANSCODE_TEMP_DIR: z.string().default('/tmp/cineseya-transcode'),
  TRANSCODE_PROFILE_VERSION: z.string().trim().min(1).max(40).default('1'),
  TRANSCODE_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(5).default(2),
  TRANSCODE_SEGMENT_SECONDS: z.coerce.number().int().min(4).max(10).default(6),
  TRANSCODE_POLL_INTERVAL_MS: z.coerce.number().int().min(1_000).max(60_000).default(5_000),
  STREAM_SESSION_TTL_SECONDS: z.coerce.number().int().min(900).max(43_200).default(14_400),
  TURNSTILE_SECRET_KEY: z.string().optional(),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) throw new Error(`Invalid environment configuration: ${parsed.error.message}`);

export const env = parsed.data;
export const siteUrl = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
export const publicAssetOrigin = env.PUBLIC_ASSET_DOMAIN ? new URL(env.PUBLIC_ASSET_DOMAIN).origin : undefined;
export const useDemoData = env.CINESEYA_DEMO_MODE === 'true' || env.CINERUSUBS_DEMO_MODE === 'true' || !env.MONGODB_URI;

export function assertProductionEnvironment() {
  if (env.NODE_ENV !== 'production') return;
  const missing: string[] = [];
  if (!env.MONGODB_URI) missing.push('MONGODB_URI');
  if (!env.R2_ACCOUNT_ID) missing.push('R2_ACCOUNT_ID');
  if (!env.R2_ACCESS_KEY_ID) missing.push('R2_ACCESS_KEY_ID');
  if (!env.R2_SECRET_ACCESS_KEY) missing.push('R2_SECRET_ACCESS_KEY');
  if (!env.R2_MEDIA_BUCKET) missing.push('R2_MEDIA_BUCKET');
  if (!env.R2_ASSETS_BUCKET) missing.push('R2_ASSETS_BUCKET');
  if (env.R2_MEDIA_BUCKET === env.R2_ASSETS_BUCKET) missing.push('separate R2_MEDIA_BUCKET and R2_ASSETS_BUCKET values');
  if (!publicAssetOrigin) missing.push('PUBLIC_ASSET_DOMAIN');
  if (env.DOWNLOAD_WORKER_ENABLED === 'true' && !env.DOWNLOAD_DOMAIN) missing.push('DOWNLOAD_DOMAIN');
  if (env.SESSION_SECRET.startsWith('development-')) missing.push('SESSION_SECRET');
  if (env.DOWNLOAD_SIGNING_SECRET.startsWith('development-')) missing.push('DOWNLOAD_SIGNING_SECRET');
  if (!env.NEXT_PUBLIC_SITE_URL.startsWith('https://')) missing.push('NEXT_PUBLIC_SITE_URL (HTTPS)');
  if (missing.length) throw new Error(`Production launch blocked: configure ${missing.join(', ')}`);
}
