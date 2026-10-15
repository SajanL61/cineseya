import { absoluteSiteUrl } from "@/lib/assets";

export const SEO_ORIGIN = "https://cineseya.lk";
export const SEO_BRAND_NAME = "CineSeya";
export const SEO_SITE_NAME = "CineSeya.lk";
export const SEO_DEFAULT_TITLE =
  "CineSeya.lk – Sinhala Subtitles, Movies & TV Series";
export const SEO_DEFAULT_DESCRIPTION =
  "Discover movies and TV series, browse release-matched Sinhala subtitles, and follow trusted CineSeya translators.";
export const SEO_DEFAULT_IMAGE = `${SEO_ORIGIN}/og-default.png`;

const privateStorageHost = /(^|\.)r2\.cloudflarestorage\.com$/i;

export function canonicalUrl(path = "/") {
  const safePath = path.startsWith("/") && !path.startsWith("//") ? path : "/";
  const url = new URL(safePath, `${SEO_ORIGIN}/`);
  url.hash = "";
  return url.toString();
}

export function canonicalOverride(value: string | undefined, fallbackPath: string) {
  if (!value?.trim()) return canonicalUrl(fallbackPath);
  try {
    const url = new URL(value.trim(), `${SEO_ORIGIN}/`);
    if (url.origin !== SEO_ORIGIN || url.search || url.hash) {
      return canonicalUrl(fallbackPath);
    }
    return url.toString();
  } catch {
    return canonicalUrl(fallbackPath);
  }
}

export function conciseDescription(value: string, fallback: string, max = 160) {
  const normalized = value.replace(/\s+/g, " ").trim() || fallback;
  if (normalized.length <= max) return normalized;
  const shortened = normalized.slice(0, max - 1);
  const boundary = shortened.lastIndexOf(" ");
  const cut = boundary > max * 0.7 ? boundary : shortened.length;
  return `${shortened.slice(0, cut).trim()}…`;
}

export function hasSinhalaSubtitle(languages: string[]) {
  return languages.some((language) =>
    /^(si|sin|sinhala|සිංහල)$/i.test(language.trim()),
  );
}

export function publicSeoImage(value: unknown, fallback = SEO_DEFAULT_IMAGE) {
  const resolved = absoluteSiteUrl(value, SEO_ORIGIN);
  if (!resolved) return fallback;
  try {
    const url = new URL(resolved);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      privateStorageHost.test(url.hostname)
    ) {
      return fallback;
    }
    return url.toString();
  } catch {
    return fallback;
  }
}

export function socialMetadata(title: string, description: string, path: string, image = SEO_DEFAULT_IMAGE) {
  const safeImage = publicSeoImage(image);
  return {
    openGraph: {
      type: 'website' as const,
      siteName: SEO_BRAND_NAME,
      title,
      description,
      url: canonicalUrl(path),
      images: [{ url: safeImage, alt: title }],
    },
    twitter: {
      card: 'summary_large_image' as const,
      title,
      description,
      images: [safeImage],
    },
  };
}

export function officialSocialUrls(settings: Record<string, unknown>) {
  return [
    "facebook",
    "instagram",
    "youtube",
    "tiktok",
    "x",
    "telegram",
  ]
    .map((key) => settings[key])
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter((value) => {
      try {
        const url = new URL(value);
        return url.protocol === "https:" && !url.username && !url.password;
      } catch {
        return false;
      }
    });
}

export function siteIdentityJsonLd(settings: Record<string, unknown>) {
  const sameAs = officialSocialUrls(settings);
  return {
    organization: {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      '@id': `${SEO_ORIGIN}/#organization`,
      name: SEO_BRAND_NAME,
      alternateName: [SEO_SITE_NAME, 'cineseya.lk'],
      url: SEO_ORIGIN,
      logo: {
        '@type': 'ImageObject',
        url: `${SEO_ORIGIN}/icon-512.png`,
        width: 512,
        height: 512,
      },
      ...(sameAs.length ? { sameAs } : {}),
    },
    website: {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      '@id': `${SEO_ORIGIN}/#website`,
      name: SEO_BRAND_NAME,
      alternateName: [SEO_SITE_NAME, 'cineseya.lk'],
      url: SEO_ORIGIN,
      description: SEO_DEFAULT_DESCRIPTION,
      inLanguage: ['en', 'si'],
      publisher: { '@id': `${SEO_ORIGIN}/#organization` },
    },
  };
}

export type BreadcrumbItem = { name: string; path: string };

export function breadcrumbJsonLd(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: canonicalUrl(item.path),
    })),
  };
}

export function isoDate(value: string | undefined) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? undefined : date.toISOString();
}
